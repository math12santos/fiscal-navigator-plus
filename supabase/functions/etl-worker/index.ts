// ETL Worker — drena a fila etl_job_items e dispatcha por pipeline_key.
// Chamado por: pg_net (após enqueue), cron, ou manualmente pela UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Item = {
  id: string;
  job_id: string;
  organization_id: string;
  pipeline_key?: string;
  raw: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type HandlerResult =
  | { status: "succeeded"; target_table?: string; target_id?: string; mapped?: unknown }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

type Handler = (item: Item, ctx: { supabase: ReturnType<typeof createClient> }) => Promise<HandlerResult>;

// Registry simples — handlers reais ficam em outras edge functions ou aqui à medida que crescem.
const HANDLERS: Record<string, Handler> = {
  // Pipeline de teste — apenas confirma processamento
  "_core.echo": async (item) => ({
    status: "succeeded",
    mapped: { echoed: item.raw, at: new Date().toISOString() },
  }),
};

async function processItem(supabase: ReturnType<typeof createClient>, item: Item): Promise<void> {
  const handler = HANDLERS[item.pipeline_key ?? ""];
  if (!handler) {
    await supabase.rpc("etl_mark_item_failure", {
      p_item_id: item.id,
      p_error: `Pipeline handler not found: ${item.pipeline_key}`,
    });
    return;
  }

  try {
    const result = await handler(item, { supabase });
    if (result.status === "succeeded") {
      await supabase.rpc("etl_mark_item_success", {
        p_item_id: item.id,
        p_target_table: result.target_table ?? null,
        p_target_id: result.target_id ?? null,
        p_mapped: result.mapped ?? null,
      });
    } else if (result.status === "skipped") {
      await supabase.rpc("etl_mark_item_skipped", {
        p_item_id: item.id,
        p_reason: result.reason,
      });
    } else {
      await supabase.rpc("etl_mark_item_failure", {
        p_item_id: item.id,
        p_error: result.error,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.rpc("etl_mark_item_failure", { p_item_id: item.id, p_error: msg });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Pega lote pronto para processar
  const limit = 50;
  const { data: claimed, error: claimErr } = await supabase.rpc("etl_claim_items", { p_limit: limit });
  if (claimErr) {
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = (claimed ?? []) as Item[];
  if (items.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Enriquecer com pipeline_key (vindo do job)
  const jobIds = Array.from(new Set(items.map((i) => i.job_id)));
  const { data: jobs } = await supabase
    .from("etl_jobs")
    .select("id, pipeline_key")
    .in("id", jobIds);

  const pipelineByJob = new Map<string, string>(
    (jobs ?? []).map((j: { id: string; pipeline_key: string }) => [j.id, j.pipeline_key]),
  );

  for (const item of items) {
    item.pipeline_key = pipelineByJob.get(item.job_id);
    await processItem(supabase, item);
  }

  // Finaliza jobs afetados
  for (const jobId of jobIds) {
    await supabase.rpc("etl_finalize_job", { p_job_id: jobId });
  }

  return new Response(JSON.stringify({ processed: items.length, jobs: jobIds.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
