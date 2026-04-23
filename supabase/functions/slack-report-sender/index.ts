// Camada 3 — Adaptador Slack para relatórios
// Reusa o padrão do slack-proxy: chat.postMessage com bloco de texto + link assinado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface ReqBody {
  run_id: string;
  chat_binding_id: string;
  recipient_user_id?: string;
  recipient_role?: string;
  text: string;
  signed_url?: string;
}

function maskChatId(chatId: string) {
  if (!chatId) return "";
  return chatId.length <= 4 ? "***" : `***${chatId.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!SLACK_API_KEY) throw new Error("SLACK_API_KEY não configurada");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = (await req.json()) as ReqBody;

    const { data: binding } = await supabase
      .from("org_chat_bindings")
      .select("id, organization_id, channel, chat_id, active")
      .eq("id", body.chat_binding_id)
      .maybeSingle();
    if (!binding) throw new Error("Vínculo não encontrado");
    if (!binding.active) throw new Error("Vínculo inativo");
    if (binding.channel !== "slack") throw new Error("Vínculo não é do canal Slack");

    const { data: run } = await supabase
      .from("report_runs")
      .select("id, organization_id, signed_token")
      .eq("id", body.run_id)
      .maybeSingle();
    if (!run) throw new Error("Execução não encontrada");

    if (run.organization_id !== binding.organization_id) {
      throw new Error("ORG_MISMATCH");
    }

    const { data: delivery } = await supabase
      .from("report_deliveries")
      .insert({
        run_id: body.run_id,
        organization_id: binding.organization_id,
        recipient_user_id: body.recipient_user_id ?? null,
        recipient_role: body.recipient_role ?? null,
        channel: "slack",
        chat_binding_id: binding.id,
        chat_id_masked: maskChatId(binding.chat_id),
        signed_link_token: run.signed_token,
        status: "pending",
        delivery_attempt: 1,
      })
      .select("id")
      .single();

    const blocks: any[] = [
      { type: "section", text: { type: "mrkdwn", text: body.text.slice(0, 2900) } },
    ];
    if (body.signed_url) {
      blocks.push({
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "📄 Abrir relatório" }, url: body.signed_url },
        ],
      });
    }

    const res = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: binding.chat_id,
        text: body.text.slice(0, 200),
        blocks,
        username: "Colli FinCore",
        icon_emoji: ":chart_with_upwards_trend:",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      await supabase
        .from("report_deliveries")
        .update({ status: "failed", error: JSON.stringify(data).slice(0, 500) })
        .eq("id", delivery!.id);
      throw new Error(`Slack: ${data.error}`);
    }

    await supabase
      .from("report_deliveries")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        external_message_id: String(data.ts ?? ""),
      })
      .eq("id", delivery!.id);

    return new Response(JSON.stringify({ ok: true, delivery_id: delivery!.id, ts: data.ts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
