// Camada 3 — Adaptador Telegram
// Envia texto + documento via gateway. Cria report_deliveries com external_message_id
// para futura validação de callback_query.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

interface ReqBody {
  run_id: string;
  chat_binding_id: string;
  recipient_user_id?: string;
  recipient_role?: string;
  text: string;
  signed_url?: string;
  escalation_level?: number;
  escalated_from?: string;
}

function maskChatId(chatId: string) {
  if (!chatId) return "";
  const s = String(chatId);
  return s.length <= 4 ? "***" : `***${s.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY não configurada (conecte o Telegram em Connectors)");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = (await req.json()) as ReqBody;

    const { data: binding, error: bindErr } = await supabase
      .from("org_chat_bindings")
      .select("id, organization_id, channel, chat_id, active")
      .eq("id", body.chat_binding_id)
      .maybeSingle();
    if (bindErr || !binding) throw new Error("Vínculo de chat não encontrado");
    if (!binding.active) throw new Error("Vínculo inativo");
    if (binding.channel !== "telegram") throw new Error("Vínculo não é do canal Telegram");

    const { data: run, error: runErr } = await supabase
      .from("report_runs")
      .select("id, organization_id, signed_token")
      .eq("id", body.run_id)
      .maybeSingle();
    if (runErr || !run) throw new Error("Execução de relatório não encontrada");

    // CRÍTICO: validação cross-tenant
    if (run.organization_id !== binding.organization_id) {
      throw new Error("ORG_MISMATCH: o vínculo de chat pertence a outra organização");
    }

    // Pré-cria delivery em pending
    const { data: delivery, error: delErr } = await supabase
      .from("report_deliveries")
      .insert({
        run_id: body.run_id,
        organization_id: binding.organization_id,
        recipient_user_id: body.recipient_user_id ?? null,
        recipient_role: body.recipient_role ?? null,
        channel: "telegram",
        chat_binding_id: binding.id,
        chat_id_masked: maskChatId(binding.chat_id),
        signed_link_token: run.signed_token,
        escalation_level: body.escalation_level ?? 1,
        escalated_from: body.escalated_from ?? null,
        status: "pending",
        delivery_attempt: 1,
      })
      .select("id")
      .single();
    if (delErr) throw new Error(`Pré-criação delivery: ${delErr.message}`);

    // Botões inline para feedback (callback_data carrega delivery_id)
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "👍 Útil", callback_data: `fb:useful:${delivery.id}` },
          { text: "👎 Não útil", callback_data: `fb:not_useful:${delivery.id}` },
        ],
        body.signed_url ? [{ text: "📄 Abrir relatório", url: body.signed_url }] : [],
      ].filter((row) => row.length > 0),
    };

    const sendRes = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: binding.chat_id,
        text: body.text.slice(0, 4000),
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      }),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok || !sendData.ok) {
      await supabase
        .from("report_deliveries")
        .update({ status: "failed", error: JSON.stringify(sendData).slice(0, 500) })
        .eq("id", delivery.id);
      throw new Error(`Telegram sendMessage [${sendRes.status}]: ${JSON.stringify(sendData)}`);
    }

    const messageId = String(sendData.result?.message_id ?? "");

    await supabase
      .from("report_deliveries")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        external_message_id: messageId,
      })
      .eq("id", delivery.id);

    return new Response(
      JSON.stringify({ ok: true, delivery_id: delivery.id, message_id: messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
