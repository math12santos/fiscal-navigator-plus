/**
 * Hook centralizado de dias úteis efetivos por mês e por colaborador.
 *
 * Hierarquia de prioridade:
 *   1. Override individual (payroll_business_days_overrides) — ajuste pontual
 *      por colaborador dentro de uma rodada de folha (folgas, banco de horas,
 *      afastamento parcial).
 *   2. Override mensal da organização (dp_business_days) — calendário do mês
 *      (ex.: ponte de carnaval, banco de horas concedido coletivamente).
 *   3. Cálculo automático seg-sex (getBusinessDays).
 *
 * Princípio CFO-first: toda decisão de cálculo é explicável e rastreável
 * via `reason` (override individual) ou `notes` (override mensal).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { startOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getBusinessDays } from "@/hooks/usePayrollProjections";

export interface BusinessDayOverride {
  id: string;
  organization_id: string;
  reference_month: string; // yyyy-MM-dd (dia 1)
  business_days: number;
  notes: string | null;
}

export interface PayrollDayOverride {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  organization_id: string;
  business_days_used: number;
  reason: string | null;
}

/** Normaliza uma data ou string para "yyyy-MM-01" (chave do mês). */
export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(startOfMonth(d), "yyyy-MM-dd");
}

/**
 * Resolve dias úteis aplicáveis (versão sync — para uso dentro de loops em
 * componentes que já têm os overrides carregados).
 */
export function resolveBusinessDays(
  month: Date | string,
  monthlyOverrides: BusinessDayOverride[] = [],
  employeeOverride?: PayrollDayOverride | null,
): { days: number; source: "individual" | "monthly" | "auto"; reason?: string } {
  if (employeeOverride) {
    return {
      days: employeeOverride.business_days_used,
      source: "individual",
      reason: employeeOverride.reason ?? undefined,
    };
  }
  const key = monthKey(month);
  const monthly = monthlyOverrides.find((o) => o.reference_month === key);
  if (monthly) {
    return { days: monthly.business_days, source: "monthly", reason: monthly.notes ?? undefined };
  }
  const d = typeof month === "string" ? new Date(month) : month;
  return { days: getBusinessDays(d), source: "auto" };
}

/** Lista os overrides mensais da organização (todos os meses cadastrados). */
export function useBusinessDayOverrides() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["dp_business_days", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("dp_business_days")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("reference_month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BusinessDayOverride[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateBusinessDayOverride() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const upsert = useMutation({
    mutationFn: async (input: { reference_month: string; business_days: number; notes?: string | null }) => {
      const payload = {
        organization_id: currentOrg!.id,
        user_id: user!.id,
        reference_month: input.reference_month,
        business_days: input.business_days,
        notes: input.notes ?? null,
      };
      const { error } = await (supabase.from as any)("dp_business_days")
        .upsert(payload, { onConflict: "organization_id,reference_month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dp_business_days"] }),
  });

  const remove = useMutation({
    mutationFn: async (referenceMonth: string) => {
      const { error } = await (supabase.from as any)("dp_business_days")
        .delete()
        .eq("organization_id", currentOrg!.id)
        .eq("reference_month", referenceMonth);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dp_business_days"] }),
  });

  return { upsert, remove };
}

/** Lista os overrides individuais por colaborador para uma rodada de folha. */
export function usePayrollDayOverrides(payrollRunId?: string) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["payroll_day_overrides", currentOrg?.id, payrollRunId],
    queryFn: async () => {
      if (!payrollRunId) return [];
      const { data, error } = await (supabase.from as any)("payroll_business_days_overrides")
        .select("*")
        .eq("payroll_run_id", payrollRunId);
      if (error) throw error;
      return (data ?? []) as PayrollDayOverride[];
    },
    enabled: !!currentOrg?.id && !!payrollRunId,
  });
}

export function useMutatePayrollDayOverride() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const upsert = useMutation({
    mutationFn: async (input: {
      payroll_run_id: string;
      employee_id: string;
      business_days_used: number;
      reason?: string | null;
    }) => {
      const payload = {
        organization_id: currentOrg!.id,
        user_id: user!.id,
        payroll_run_id: input.payroll_run_id,
        employee_id: input.employee_id,
        business_days_used: input.business_days_used,
        reason: input.reason ?? null,
      };
      const { error } = await (supabase.from as any)("payroll_business_days_overrides")
        .upsert(payload, { onConflict: "payroll_run_id,employee_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_day_overrides"] }),
  });

  const remove = useMutation({
    mutationFn: async (input: { payroll_run_id: string; employee_id: string }) => {
      const { error } = await (supabase.from as any)("payroll_business_days_overrides")
        .delete()
        .eq("payroll_run_id", input.payroll_run_id)
        .eq("employee_id", input.employee_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_day_overrides"] }),
  });

  return { upsert, remove };
}

/**
 * Hook reativo para um único mês: retorna `days`, `source` e `reason`.
 * Usado por dashboards e listagens (sem contexto de payroll_run).
 */
export function useBusinessDaysForMonth(month: Date | string) {
  const { data: overrides = [] } = useBusinessDayOverrides();
  return useMemo(() => resolveBusinessDays(month, overrides, null), [month, overrides]);
}
