// Webhook de feedback do Telegram (público).
// SEGURANÇA: aceita SOMENTE callback_query cujo callback_data está no formato
// "fb:<score>:<delivery_id>" e cujo delivery existe no banco.
// Qualquer outro tipo de update (mensagens, comandos) é descartado silenciosamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("ok", { headers: corsHeaders });

  try {
    const update = await req.json();
    const cb = update?.callback_query;
    if (!cb) return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });

    const data: string = cb.data || "";
    const m = data.match(/^fb:(useful|not_useful):([0-9a-f-]{36})$/i);
    if (!m) return new Response(JSON.stringify({ ok: true, ignored: "bad_format" }), { headers: corsHeaders });

    const score = m[1];
    const deliveryId = m[2];

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Valida que o delivery existe E que o message_id bate
    const { data: delivery } = await supabase
      .from("report_deliveries")
      .select("id, external_message_id")
      .eq("id", deliveryId)
      .maybeSingle();

    const expectedMsgId = String(cb.message?.message_id ?? "");
    if (!delivery || delivery.external_message_id !== expectedMsgId) {
      return new Response(JSON.stringify({ ok: true, ignored: "unknown_delivery" }), { headers: corsHeaders });
    }

    await supabase
      .from("report_deliveries")
      .update({
        feedback_score: score,
        feedback_at: new Date().toISOString(),
        status: "read",
      })
      .eq("id", deliveryId);

    // Confirma ao Telegram para sumir o "loading" do botão
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (LOVABLE_API_KEY && TELEGRAM_API_KEY) {
      await fetch(`${GATEWAY_URL}/answerCallbackQuery`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TELEGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: score === "useful" ? "Obrigado pelo feedback! 👍" : "Obrigado, vamos melhorar.",
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e: any) {
    // Engole o erro para não vazar info; loga internamente
    console.error("telegram-feedback error", e?.message ?? e);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }
});
