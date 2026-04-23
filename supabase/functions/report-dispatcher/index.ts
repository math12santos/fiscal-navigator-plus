// Camada 2 — Motor de Notificações
// Pode ser chamado:
//  (a) sem body → varre report_schedules com next_run_at <= now() (cron poll)
//  (b) com { schedule_id } → dispara manualmente um agendamento específico
//  (c) com { run_id, recipient_overrides? } → reusa um run e dispara para outros recipients
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callFn(name: string, body: unknown) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function dispatchSchedule(supabase: any, scheduleId: string) {
  const { data: sched } = await supabase
    .from("report_schedules")
    .select("id, organization_id, template_code, mask_values, enabled")
    .eq("id", scheduleId)
    .maybeSingle();
  if (!sched || !sched.enabled) return { skipped: true };

  // Gera o relatório
  const gen = await callFn("report-generator", {
    template_code: sched.template_code,
    organization_id: sched.organization_id,
    schedule_id: sched.id,
    trigger_source: "cron",
  });
  if (!gen.run_id) return { error: gen.error ?? "generator failed" };

  // Resolve destinatários
  const { data: recipients } = await supabase
    .from("report_recipients")
    .select("id, user_id, role, chat_binding_id, mask_values_override")
    .eq("schedule_id", sched.id)
    .eq("active", true);

  const results: any[] = [];
  for (const r of recipients ?? []) {
    if (!r.chat_binding_id) continue; // requer canal definido
    const { data: binding } = await supabase
      .from("org_chat_bindings")
      .select("id, channel, organization_id, active")
      .eq("id", r.chat_binding_id)
      .maybeSingle();
    if (!binding || !binding.active) continue;
    if (binding.organization_id !== sched.organization_id) continue; // safety

    const fnName = binding.channel === "telegram" ? "telegram-sender" : "slack-report-sender";
    const sendRes = await callFn(fnName, {
      run_id: gen.run_id,
      chat_binding_id: r.chat_binding_id,
      recipient_user_id: r.user_id ?? undefined,
      recipient_role: r.role ?? undefined,
      text: gen.text_preview,
      signed_url: gen.signed_url,
    });
    results.push({ recipient_id: r.id, channel: binding.channel, ...sendRes });
  }

  // Atualiza last_run_at
  await supabase
    .from("report_schedules")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", sched.id);

  return { run_id: gen.run_id, deliveries: results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    if (body.schedule_id) {
      const r = await dispatchSchedule(supabase, body.schedule_id);
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cron poll: pega schedules pendentes
    const { data: due } = await supabase
      .from("report_schedules")
      .select("id")
      .eq("enabled", true)
      .lte("next_run_at", new Date().toISOString())
      .limit(20);

    const out: any[] = [];
    for (const s of due ?? []) {
      out.push(await dispatchSchedule(supabase, s.id));
    }

    return new Response(JSON.stringify({ processed: out.length, results: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
