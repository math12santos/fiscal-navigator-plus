import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

/**
 * `tributavel: true` → entra na base de cálculo do INSS/IRRF do empregado.
 * Proventos isentos (ajuda de custo, diárias) somam ao bruto/líquido mas
 * não impactam tributos.
 */
export const PAYROLL_EVENT_TYPES = [
  { value: "hora_extra_50", label: "Hora extra 50%", signal: "provento", tributavel: true },
  { value: "hora_extra_100", label: "Hora extra 100%", signal: "provento", tributavel: true },
  { value: "adicional_noturno", label: "Adicional noturno", signal: "provento", tributavel: true },
  { value: "bonus", label: "Bônus", signal: "provento", tributavel: true },
  { value: "comissao_variavel", label: "Comissão variável", signal: "provento", tributavel: true },
  { value: "ajuda_custo", label: "Ajuda de custo (isento)", signal: "provento", tributavel: false },
  { value: "diarias", label: "Diárias (isento até 50%)", signal: "provento", tributavel: false },
  { value: "outros_provento", label: "Outros proventos", signal: "provento", tributavel: true },
  { value: "falta", label: "Falta", signal: "desconto", tributavel: false },
  { value: "atraso", label: "Atraso", signal: "desconto", tributavel: false },
  { value: "desconto_pontual", label: "Desconto pontual", signal: "desconto", tributavel: false },
  { value: "adiantamento", label: "Adiantamento", signal: "desconto", tributavel: false },
  { value: "vale", label: "Vale", signal: "desconto", tributavel: false },
  { value: "outros_desconto", label: "Outros descontos", signal: "desconto", tributavel: false },
] as const;

export type PayrollEventType = (typeof PAYROLL_EVENT_TYPES)[number]["value"];

/** Lookup: event_type → tributável? Default false (conservador). */
export function isEventTributavel(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  const def = PAYROLL_EVENT_TYPES.find((e) => e.value === eventType);
  return def?.tributavel ?? false;
}

export interface PayrollEvent {
  id: string;
  organization_id: string;
  employee_id: string;
  payroll_run_id: string | null;
  user_id: string;
  event_type: PayrollEventType;
  signal: "provento" | "desconto";
  description: string;
  reference: string | null;
  quantity: number | null;
  unit_value: number | null;
  value: number;
  reference_month: string | null;
  notes: string | null;
  created_at: string;
}

export function usePayrollEvents(opts?: { runId?: string; employeeId?: string }) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["payroll_events", currentOrg?.id, opts?.runId, opts?.employeeId],
    queryFn: async () => {
      let q = (supabase.from as any)("payroll_events")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (opts?.runId) q = q.eq("payroll_run_id", opts.runId);
      if (opts?.employeeId) q = q.eq("employee_id", opts.employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PayrollEvent[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutatePayrollEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (ev: Partial<PayrollEvent>) => {
      const { error } = await (supabase.from as any)("payroll_events").insert({
        ...ev,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_events"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await (supabase.from as any)("payroll_events").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_events"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("payroll_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_events"] }),
  });

  return { create, update, remove };
}

/** Soma de proventos/descontos de eventos para uma folha. */
export function summarizeEvents(events: PayrollEvent[]) {
  let proventos = 0;
  let descontos = 0;
  events.forEach((e) => {
    if (e.signal === "provento") proventos += Number(e.value || 0);
    else descontos += Number(e.value || 0);
  });
  return { proventos, descontos, liquido: proventos - descontos };
}
