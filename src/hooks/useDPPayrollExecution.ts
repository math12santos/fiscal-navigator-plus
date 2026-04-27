import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";

/**
 * Cruza as projeções DP do mês com as entradas materializadas em
 * `cashflow_entries` que têm `source='dp'`, fechando visualmente o ciclo
 * "previsto → pago" da folha. Idêntico ao que o Financeiro consome,
 * porém escopado ao mês de referência.
 */
export function useDPPayrollExecution(reference: Date = new Date()) {
  const { currentOrg } = useOrganization();
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  const monthKey = format(monthStart, "yyyy-MM");

  const { payrollProjections } = usePayrollProjections(monthStart, monthEnd);

  const materializedQuery = useQuery({
    queryKey: ["dp_cashflow_entries", currentOrg?.id, monthKey],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from("cashflow_entries" as any)
        .select("id, valor_previsto, valor_realizado, status, data_prevista, data_realizada, source, source_ref")
        .eq("organization_id", currentOrg.id)
        .eq("source", "dp")
        .gte("data_prevista", format(monthStart, "yyyy-MM-dd"))
        .lte("data_prevista", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!currentOrg?.id,
  });

  return useMemo(() => {
    const materialized = materializedQuery.data ?? [];

    // Total previsto = soma das projeções (que já desconta materializadas
    // via dedup) + soma materializada (independentemente do status).
    let pago = 0;
    let aPagar = 0;
    let materializedTotal = 0;
    for (const m of materialized) {
      const valor = Number(m.valor_realizado ?? m.valor_previsto ?? 0);
      // provisões acumuladas são informativas e não impactam o caixa real
      if ((m as any).dp_sub_category === "provisao_acumulada") continue;
      materializedTotal += valor;
      if (m.status === "pago" || m.status === "concluido") pago += valor;
      else aPagar += valor;
    }

    const projectedTotal = (payrollProjections as any[])
      .filter((p) => p.dp_sub_category !== "provisao_acumulada")
      .reduce((s, p) => s + Number(p.valor_previsto || 0), 0);

    aPagar += projectedTotal;

    const previsto = materializedTotal + projectedTotal;
    const pct = previsto > 0 ? Math.min(100, (pago / previsto) * 100) : 0;

    return {
      monthKey,
      monthStart,
      monthEnd,
      previsto,
      pago,
      aPagar,
      pct,
      materializedCount: materialized.length,
      projectionsCount: (payrollProjections as any[]).length,
      isLoading: materializedQuery.isLoading,
    };
  }, [materializedQuery.data, materializedQuery.isLoading, payrollProjections, monthKey, monthStart, monthEnd]);
}
