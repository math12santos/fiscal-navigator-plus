import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { headers, sampleRows } = await req.json();

    const systemPrompt = `You are a financial data mapping assistant. You analyze CSV/XLSX column headers and sample data rows to determine the best mapping to a target financial system schema.

Target fields (the user's system fields):
- descricao (string, REQUIRED) — Description of the financial entry
- valor_previsto (number, REQUIRED) — Expected/planned amount
- data_prevista (date, REQUIRED) — Expected/due date
- data_realizada (date) — Actual payment date
- entity_name (string) — Supplier or client name
- categoria (string) — Expense category
- documento (string) — Document number
- conta_bancaria_nome (string) — Bank account name
- notes (string) — Observations/notes
- ignorar — Column should not be imported

You must also detect:
- separator: the CSV separator used (;, comma, or tab)
- date_format: the date format in the data (e.g. dd/MM/yyyy, yyyy-MM-dd, MM/dd/yyyy)
- number_format: "br" if decimal comma (1.234,56) or "us" if decimal point (1,234.56)

For each source column, assign the best target field and a confidence level (high, medium, low).`;

    const userPrompt = `Analyze these column headers and sample data:

Headers: ${JSON.stringify(headers)}

Sample rows (first 5):
${sampleRows.map((r: string[], i: number) => `Row ${i + 1}: ${JSON.stringify(r)}`).join("\n")}

Map each source column to the best target field.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
              name: "suggest_mapping",
              description: "Return the detected file format and suggested column mapping",
              parameters: {
                type: "object",
                properties: {
                  separator: { type: "string", enum: [";", ",", "\t"], description: "Detected CSV separator" },
                  date_format: { type: "string", description: "Detected date format pattern" },
                  number_format: { type: "string", enum: ["br", "us"], description: "Number format" },
                  mappings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        source_column: { type: "string", description: "Original column header from the file" },
                        target_field: {
                          type: "string",
                          enum: [
                            "descricao",
                            "valor_previsto",
                            "data_prevista",
                            "data_realizada",
                            "entity_name",
                            "categoria",
                            "documento",
                            "conta_bancaria_nome",
                            "notes",
                            "ignorar",
                          ],
                        },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["source_column", "target_field", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["separator", "date_format", "number_format", "mappings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_mapping" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds at Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const mapping = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(mapping), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-import-mapping error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
