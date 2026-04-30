import { supabase } from "@/integrations/supabase/client";
import { sanitizeIdFields } from "./sanitize";

export interface ProcessFilters {
  status?: string;
  probabilidade?: string;
}

export async function listProcesses(orgId: string, filters?: ProcessFilters) {
  let q = supabase.from("juridico_processes" as any).select("*").eq("organization_id", orgId);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.probabilidade) q = q.eq("probabilidade", filters.probabilidade);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function upsertProcess(orgId: string, input: any) {
  const { data: u } = await supabase.auth.getUser();
  const payload = sanitizeIdFields({ ...input, organization_id: orgId });
  if (input.id) {
    const { data, error } = await supabase
      .from("juridico_processes" as any)
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  payload.user_id = u.user?.id;
  const { data, error } = await supabase
    .from("juridico_processes" as any)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProcess(id: string) {
  const { error } = await supabase.from("juridico_processes" as any).delete().eq("id", id);
  if (error) throw error;
}
