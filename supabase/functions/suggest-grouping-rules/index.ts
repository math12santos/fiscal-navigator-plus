import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, existing_groups } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch last 500 entries
    const { data: entries, error: entriesError } = await supabase
      .from("cashflow_entries")
      .select("descricao, categoria, source, entity_id, tipo")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (entriesError) throw entriesError;

    if (!entries || entries.length < 5) {
      return new Response(JSON.stringify({ suggestions: [], message: "Poucos lançamentos para análise" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Summarize patterns
    const descFreq: Record<string, number> = {};
    const catFreq: Record<string, number> = {};
    const sourceFreq: Record<string, number> = {};

    for (const e of entries) {
      if (e.descricao) {
        const normalized = e.descricao.toLowerCase().trim();
        descFreq[normalized] = (descFreq[normalized] || 0) + 1;
      }
      if (e.categoria) catFreq[e.categoria] = (catFreq[e.categoria] || 0) + 1;
      if (e.source) sourceFreq[e.source] = (sourceFreq[e.source] || 0) + 1;
    }

    const topDescriptions = Object.entries(descFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([desc, count]) => `"${desc}" (${count}x)`);

    const topCategories = Object.entries(catFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([cat, count]) => `"${cat}" (${count}x)`);

    const groupsContext = existing_groups
      ? `\nGrupos existentes na organização: ${JSON.stringify(existing_groups)}`
      : "";

    const systemPrompt = `Você é um assistente financeiro especialista em classificação de lançamentos financeiros empresariais.
Analise os padrões de lançamentos abaixo e sugira regras de classificação automática.

Cada regra deve ter:
- name: nome descritivo da regra
- match_field: "descricao" | "categoria" | "source"
- operator: "contains" | "equals" | "starts_with"
- match_value: valor para match (se match_field != descricao)
- match_keyword: palavras-chave separadas por vírgula (se match_field == descricao)
- suggested_group: nome do grupo destino sugerido
- coverage: número estimado de lançamentos que a regra cobriria
- priority: 1-20 (quanto maior, mais prioritária)

Priorize regras que:
1. Cubram o maior número de lançamentos
2. Sejam específicas o suficiente para não gerar falsos positivos
3. Agrupem lançamentos semanticamente relacionados
${groupsContext}`;

    const userPrompt = `Dados de ${entries.length} lançamentos recentes:

Descrições mais frequentes: ${topDescriptions.join(", ")}

Categorias: ${topCategories.join(", ")}

Fontes: ${Object.entries(sourceFreq).map(([s, c]) => `${s}(${c})`).join(", ")}

Sugira de 5 a 10 regras de classificação otimizadas.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_grouping_rules",
              description: "Return suggested grouping rules for financial entries classification.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        match_field: { type: "string", enum: ["descricao", "categoria", "source"] },
                        operator: { type: "string", enum: ["contains", "equals", "starts_with"] },
                        match_value: { type: "string" },
                        match_keyword: { type: "string", description: "Comma-separated keywords for descricao field" },
                        suggested_group: { type: "string" },
                        coverage: { type: "number" },
                        priority: { type: "number" },
                      },
                      required: ["name", "match_field", "operator", "suggested_group", "coverage", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_grouping_rules" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ suggestions: [], message: "IA não retornou sugestões" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ suggestions: parsed.suggestions ?? [], total_entries: entries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-grouping-rules error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
