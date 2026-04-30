import { supabase } from "@/integrations/supabase/client";
import type { CreateJobInput, EtlJob, EtlPipeline } from "../_contracts/etl";

export async function listPipelines(): Promise<EtlPipeline[]> {
  const { data, error } = await supabase
    .from("etl_pipelines")
    .select("*")
    .eq("active", true)
    .order("module")
    .order("label");
  if (error) throw error;
  return (data ?? []) as EtlPipeline[];
}

export async function listJobs(organizationId: string, limit = 50): Promise<EtlJob[]> {
  const { data, error } = await supabase
    .from("etl_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EtlJob[];
}

export async function getJob(jobId: string): Promise<EtlJob | null> {
  const { data, error } = await supabase
    .from("etl_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return (data as EtlJob) ?? null;
}

export async function createJob(input: CreateJobInput): Promise<string> {
  const { data: job, error: jobErr } = await supabase
    .from("etl_jobs")
    .insert({
      organization_id: input.organizationId,
      pipeline_key: input.pipelineKey,
      module: input.module,
      source: input.source,
      idempotency_key: input.idempotencyKey,
      params: input.params ?? {},
      total_count: input.items.length,
    })
    .select("id")
    .single();
  if (jobErr) throw jobErr;
  const jobId = (job as { id: string }).id;

  if (input.items.length > 0) {
    const rows = input.items.map((it, idx) => ({
      job_id: jobId,
      organization_id: input.organizationId,
      seq: idx,
      external_ref: it.externalRef ?? null,
      idempotency_key: it.idempotencyKey,
      raw: it.raw,
    }));
    // Insert em chunks de 500
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error: itemsErr } = await supabase.from("etl_job_items").insert(slice);
      if (itemsErr) throw itemsErr;
    }
  }

  // Dispara worker (best-effort, não bloqueia)
  void supabase.functions.invoke("etl-worker").catch(() => undefined);

  return jobId;
}

export async function cancelJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc("etl_cancel_job", { p_job_id: jobId });
  if (error) throw error;
}

export async function retryFailed(jobId: string): Promise<number> {
  const { data, error } = await supabase.rpc("etl_retry_failed", { p_job_id: jobId });
  if (error) throw error;
  // Dispara worker
  void supabase.functions.invoke("etl-worker").catch(() => undefined);
  return (data as number) ?? 0;
}

export async function runWorkerNow(): Promise<{ processed: number }> {
  const { data, error } = await supabase.functions.invoke("etl-worker");
  if (error) throw error;
  return data as { processed: number };
}
