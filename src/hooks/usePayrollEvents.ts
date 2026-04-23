import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export const PAYROLL_EVENT_TYPES = [
  { value: "hora_extra_50", label: "Hora extra 50%", signal: "provento" },
  { value: "hora_extra_100", label: "Hora extra 100%", signal: "provento" },
  { value: "adicional_noturno", label: "Adicional noturno", signal: "provento" },
  { value: "bonus", label: "Bônus", signal: "provento" },
  { value: "comissao_variavel", label: "Comissão variável", signal: "provento" },
  { value: "outros_provento", label: "Outros proventos", signal: "provento" },
  { value: "falta", label: "Falta", signal: "desconto" },
  { value: "atraso", label: "Atraso", signal: "desconto" },
  { value: "desconto_pontual", label: "Desconto pontual", signal: "desconto" },
  { value: "adiantamento", label: "Adiantamento", signal: "desconto" },
  { value: "vale", label: "Vale", signal: "desconto" },
  { value: "outros_desconto", label: "Outros descontos", signal: "desconto" },
] as const;

export type PayrollEventType = (typeof PAYROLL_EVENT_TYPES)[number]["value"];

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
