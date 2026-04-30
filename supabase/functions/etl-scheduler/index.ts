// ETL Scheduler — invoca etl-worker periodicamente. Pode ser chamado por pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Drena worker (até 5 batches)
  const workerUrl = `${SUPABASE_URL}/functions/v1/etl-worker`;
  let totalProcessed = 0;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(workerUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    });
    if (!r.ok) break;
    const j = (await r.json()) as { processed?: number };
    totalProcessed += j.processed ?? 0;
    if ((j.processed ?? 0) === 0) break;
  }

  // 2. Enfileira jobs cron (pipelines com cron_expr definido)
  // No MVP, dispara 1x/dia para todas orgs ativas dos pipelines cron.
  // Cron real (granularidade) pode ser refinado por pipeline depois.
  const { data: cronPipelines } = await supabase
    .from("etl_pipelines")
    .select("key, module, max_attempts")
    .eq("active", true)
    .not("cron_expr", "is", null);

  let enqueued = 0;
  if (cronPipelines && cronPipelines.length > 0) {
    const { data: orgs } = await supabase.from("organizations").select("id").limit(1000);
    const today = new Date().toISOString().slice(0, 10);
    for (const pipe of cronPipelines) {
      for (const org of orgs ?? []) {
        const idemp = `cron:${today}:${pipe.key}`;
        const { error } = await supabase
          .from("etl_jobs")
          .insert({
            organization_id: (org as { id: string }).id,
            pipeline_key: pipe.key,
            module: pipe.module,
            source: "cron",
            idempotency_key: idemp,
            status: "queued",
          })
          .select()
          .single();
        if (!error) enqueued++;
      }
    }
  }

  return new Response(JSON.stringify({ processed: totalProcessed, enqueued }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
