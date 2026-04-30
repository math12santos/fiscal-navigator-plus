import { supabase } from "@/integrations/supabase/client";
import { sanitizeIdFields } from "./sanitize";

export interface SettlementInstallmentInput {
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
}

export interface CreateSettlementInput {
  process_id?: string | null;
  valor_total: number;
  data_acordo: string;
  installments: SettlementInstallmentInput[];
  [k: string]: any;
}

export async function listSettlements(orgId: string, processId?: string) {
  let q = supabase.from("juridico_settlements" as any).select("*").eq("organization_id", orgId);
  if (processId) q = q.eq("process_id", processId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function createSettlement(orgId: string, input: CreateSettlementInput) {
  const { data: u } = await supabase.auth.getUser();
  const { installments, ...rest } = input;
  const payload = sanitizeIdFields({
    ...rest,
    organization_id: orgId,
    user_id: u.user?.id,
  });
  const { data: settle, error } = await supabase
    .from("juridico_settlements" as any)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  const instPayload = installments.map((i) => ({
    ...i,
    organization_id: orgId,
    settlement_id: (settle as any).id,
  }));
  const { error: e2 } = await supabase
    .from("juridico_settlement_installments" as any)
    .insert(instPayload);
  if (e2) throw e2;
  return settle;
}

export async function approveSettlement(settlementId: string) {
  const { data, error } = await supabase.rpc("juridico_approve_settlement" as any, {
    p_settlement_id: settlementId,
  });
  if (error) throw error;
  return data;
}
