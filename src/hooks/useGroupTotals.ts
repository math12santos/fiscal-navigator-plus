import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { useContracts } from "@/hooks/useContracts";
import { useLiabilities } from "@/hooks/useLiabilities";
import { format } from "date-fns";

/**
 * Returns group-level (consolidated) totals when in per-company holding mode.
 * Used to calculate participation percentages for each subsidiary.
 */
export function useGroupTotals(rangeFrom: Date, rangeTo: Date) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { holdingMode, holdingView, subsidiaryIds } = useHolding();
  const orgId = currentOrg?.id;

  const isPerCompany = holdingMode && holdingView === "per-company";
  const allOrgIds = useMemo(
    () => (orgId ? [orgId, ...subsidiaryIds] : []),
    [orgId, subsidiaryIds]
  );

  // Fetch consolidated cashflow totals for the entire group
  const groupCashflow = useQuery({
    queryKey: ["group_cashflow_totals", allOrgIds, rangeFrom?.toISOString(), rangeTo?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashflow_entries" as any)
        .select("tipo, valor_previsto, valor_realizado")
        .in("organization_id", allOrgIds)
        .gte("data_prevista", format(rangeFrom, "yyyy-MM-dd"))
        .lte("data_prevista", format(rangeTo, "yyyy-MM-dd"));
      if (error) throw error;
      let entradas = 0, saidas = 0;
      for (const e of (data ?? []) as any[]) {
        const val = Number(e.valor_realizado ?? e.valor_previsto);
        if (e.tipo === "entrada") entradas += val;
        else saidas += val;
      }
      return { entradas, saidas, saldo: entradas - saidas };
    },
    enabled: !!user && isPerCompany && allOrgIds.length > 1,
    staleTime: 30_000,
  });

  // Group contracts totals
  const groupContracts = useQuery({
    queryKey: ["group_contracts_totals", allOrgIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts" as any)
        .select("valor, tipo_recorrencia, status")
        .in("organization_id", allOrgIds)
        .eq("status", "Ativo");
      if (error) throw error;
      let count = 0, monthlyValue = 0;
      for (const c of (data ?? []) as any[]) {
        count++;
        const val = Number(c.valor);
        const rec = c.tipo_recorrencia;
        if (rec === "mensal") monthlyValue += val;
        else if (rec === "bimestral") monthlyValue += val / 2;
        else if (rec === "trimestral") monthlyValue += val / 3;
        else if (rec === "semestral") monthlyValue += val / 6;
        else if (rec === "anual") monthlyValue += val / 12;
        else monthlyValue += val;
      }
      return { count, monthlyValue };
    },
    enabled: !!user && isPerCompany && allOrgIds.length > 1,
    staleTime: 30_000,
  });

  // Group liabilities totals
  const groupLiabilities = useQuery({
    queryKey: ["group_liabilities_totals", allOrgIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liabilities" as any)
        .select("valor_atualizado, status")
        .in("organization_id", allOrgIds);
      if (error) throw error;
      let total = 0;
      for (const l of (data ?? []) as any[]) {
        total += Number(l.valor_atualizado);
      }
      return { total };
    },
    enabled: !!user && isPerCompany && allOrgIds.length > 1,
    staleTime: 30_000,
  });

  // Group employees (payroll) totals
  const groupPayroll = useQuery({
    queryKey: ["group_payroll_totals", allOrgIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees" as any)
        .select("salary_base")
        .in("organization_id", allOrgIds)
        .eq("status", "ativo");
      if (error) throw error;
      let total = 0;
      for (const e of (data ?? []) as any[]) {
        total += Number(e.salary_base);
      }
      return { total };
    },
    enabled: !!user && isPerCompany && allOrgIds.length > 1,
    staleTime: 30_000,
  });

  if (!isPerCompany) {
    return { isPerCompany: false, groupTotals: null };
  }

  return {
    isPerCompany: true,
    groupTotals: {
      entradas: groupCashflow.data?.entradas ?? 0,
      saidas: groupCashflow.data?.saidas ?? 0,
      saldo: groupCashflow.data?.saldo ?? 0,
      contractsCount: groupContracts.data?.count ?? 0,
      contractsMonthlyValue: groupContracts.data?.monthlyValue ?? 0,
      liabilitiesTotal: groupLiabilities.data?.total ?? 0,
      payrollTotal: groupPayroll.data?.total ?? 0,
    },
  };
}
