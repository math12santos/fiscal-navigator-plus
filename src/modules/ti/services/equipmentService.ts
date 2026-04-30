import { supabase } from "@/integrations/supabase/client";

function sanitize<T extends Record<string, any>>(payload: T): T {
  Object.keys(payload).forEach((k) => {
    if (k.endsWith("_id") && payload[k] === "") (payload as any)[k] = null;
  });
  return payload;
}

export async function listEquipment(orgId: string) {
  const { data, error } = await supabase
    .from("it_equipment" as any)
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function upsertEquipment(orgId: string, input: any) {
  const { data: u } = await supabase.auth.getUser();
  const payload: any = sanitize({ ...input, organization_id: orgId });
  if (input.id) {
    const { data, error } = await supabase
      .from("it_equipment" as any)
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  payload.created_by = u.user?.id;
  const { data, error } = await supabase
    .from("it_equipment" as any)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEquipment(id: string) {
  const { error } = await supabase.from("it_equipment" as any).delete().eq("id", id);
  if (error) throw error;
}
