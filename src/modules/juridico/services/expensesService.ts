import { supabase } from "@/integrations/supabase/client";
import { sanitizeIdFields } from "./sanitize";

export async function listExpenses(orgIds: string[], processId?: string) {
  if (!orgIds.length) return [] as any[];
  let q = supabase.from("juridico_expenses" as any).select("*").in("organization_id", orgIds);
  if (processId) q = q.eq("process_id", processId);
  const { data, error } = await q.order("data_despesa", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function upsertExpense(orgId: string, input: any) {
  const { data: u } = await supabase.auth.getUser();
  const payload = sanitizeIdFields({ ...input, organization_id: orgId });
  if (input.id) {
    const { data, error } = await supabase
      .from("juridico_expenses" as any)
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  payload.user_id = u.user?.id;
  const { data, error } = await supabase
    .from("juridico_expenses" as any)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function postExpenseToCashflow(expenseId: string) {
  const { data, error } = await supabase.rpc(
    "juridico_post_expense_to_cashflow" as any,
    { p_expense_id: expenseId }
  );
  if (error) throw error;
  return data;
}
