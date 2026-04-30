import { supabase } from "@/integrations/supabase/client";
import type { EtlJobItem } from "../_contracts/etl";

export async function listJobItems(jobId: string, limit = 500): Promise<EtlJobItem[]> {
  const { data, error } = await supabase
    .from("etl_job_items")
    .select("*")
    .eq("job_id", jobId)
    .order("seq", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EtlJobItem[];
}

export async function listDeadLetter(organizationId: string, limit = 200): Promise<EtlJobItem[]> {
  const { data, error } = await supabase
    .from("etl_job_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "dead")
    .order("processed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EtlJobItem[];
}

export async function retryItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc("etl_retry_item", { p_item_id: itemId });
  if (error) throw error;
  void supabase.functions.invoke("etl-worker").catch(() => undefined);
}
