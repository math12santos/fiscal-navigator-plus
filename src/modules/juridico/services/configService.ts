import { supabase } from "@/integrations/supabase/client";
import { sanitizeIdFields } from "./sanitize";

export async function getConfig(orgId: string) {
  const { data, error } = await supabase
    .from("juridico_config" as any)
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function upsertConfig(orgId: string, input: any) {
  const payload = sanitizeIdFields({ ...input, organization_id: orgId });
  const { data, error } = await supabase
    .from("juridico_config" as any)
    .upsert(payload, { onConflict: "organization_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
