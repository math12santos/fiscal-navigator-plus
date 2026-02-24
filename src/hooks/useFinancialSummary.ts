import { useMemo } from "react";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useContracts } from "@/hooks/useContracts";
import { useEmployees } from "@/hooks/useDP";
import { useDPConfig } from "@/hooks/useDP";
import { useEmployeeBenefits } from "@/hooks/useDPBenefits";
import { useLiabilities } from "@/hooks/useLiabilities";
import { usePlanningConfig } from "@/hooks/usePlanningConfig";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";
import { useCRMOpportunities, usePipelineStages } from "@/hooks/useCRM";
import { format, addDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { calcEncargosPatronais } from "@/hooks/useDP";

interface Alert {
  type: "warning" | "danger" | "info";
  title: string;
  description: string;
}

export function useFinancialSummary(rangeFrom: Date, rangeTo: Date) {
  const { entries, totals, isLoading: cashflowLoading } = useCashFlow(rangeFrom, rangeTo);
  const { contracts, isLoading: contractsLoading } = useContracts();
  const { liabilities, totals: liabTotals, isLoading: liabLoading } = useLiabilities();
  const { config: planConfig } = usePlanningConfig();
  const { avgMonthlyPayroll, isLoading: payrollLoading } = usePayrollProjections(rangeFrom, rangeTo);
  const { opportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();

  // Active contracts
  const activeContracts = useMemo(
    () => contracts.filter((c) => c.status === "Ativo"),
    [contracts]
  );

  const monthlyContractValue = useMemo(() => {
    return activeContracts.reduce((sum, c) => {
      if (c.tipo_recorrencia === "mensal") return sum + Number(c.valor);
      if (c.tipo_recorrencia === "bimestral") return sum + Number(c.valor) / 2;
      if (c.tipo_recorrencia === "trimestral") return sum + Number(c.valor) / 3;
      if (c.tipo_recorrencia === "semestral") return sum + Number(c.valor) / 6;
      if (c.tipo_recorrencia === "anual") return sum + Number(c.valor) / 12;
      return sum + Number(c.valor);
    }, 0);
  }, [activeContracts]);

  // Runway
  const now = new Date();
  const curMonthKey = format(now, "yyyy-MM");

  const monthlyBurn = useMemo(() => {
    // Average monthly outflow from cashflow entries
    const monthTotals: Record<string, number> = {};
    for (const e of entries) {
      if (e.tipo !== "saida") continue;
      const key = e.data_prevista.slice(0, 7);
      monthTotals[key] = (monthTotals[key] ?? 0) + Number(e.valor_realizado ?? e.valor_previsto);
    }
    const vals = Object.values(monthTotals);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [entries]);

  const runway = monthlyBurn > 0 ? Math.floor(totals.saldo / monthlyBurn) : Infinity;

  // Alerts
  const alerts = useMemo(() => {
    const list: Alert[] = [];
    const today = format(now, "yyyy-MM-dd");
    const thirtyDaysLater = format(addDays(now, 30), "yyyy-MM-dd");

    // Contracts expiring within 30 days
    const expiring = contracts.filter(
      (c) => c.status === "Ativo" && c.data_fim && c.data_fim >= today && c.data_fim <= thirtyDaysLater
    );
    if (expiring.length > 0) {
      list.push({
        type: "warning",
        title: `${expiring.length} contrato(s) vencem em 30 dias`,
        description: expiring.map((c) => c.nome).join(", "),
      });
    }

    // Low runway
    const alertaRunway = planConfig?.runway_alerta_meses ?? 3;
    if (runway !== Infinity && runway <= alertaRunway) {
      list.push({
        type: "danger",
        title: `Runway de apenas ${runway} mês(es)`,
        description: "Saldo atual dividido pelo burn rate mensal médio está abaixo do alerta configurado.",
      });
    }

    // Below minimum balance
    const saldoMinimo = planConfig?.saldo_minimo ?? 0;
    if (saldoMinimo > 0 && totals.saldo < saldoMinimo) {
      list.push({
        type: "danger",
        title: "Saldo abaixo do mínimo",
        description: `Saldo projetado está abaixo do mínimo configurado.`,
      });
    }

    // Judicial liabilities
    const judiciais = liabilities.filter((l) => l.status === "judicial");
    if (judiciais.length > 0) {
      list.push({
        type: "warning",
        title: `${judiciais.length} passivo(s) em fase judicial`,
        description: `Valor total: R$ ${judiciais.reduce((s, l) => s + Number(l.valor_atualizado), 0).toLocaleString("pt-BR")}`,
      });
    }

    // CRM: opportunities without recent action
    const staleOpps = opportunities.filter((o) => !o.won_at && !o.lost_at && !o.updated_at);
    if (staleOpps.length > 0) {
      list.push({
        type: "info",
        title: `${staleOpps.length} oportunidade(s) CRM sem ação recente`,
        description: "Verifique o pipeline comercial para atualizar o status.",
      });
    }

    return list;
  }, [contracts, liabilities, runway, totals.saldo, planConfig, opportunities]);

  // CRM pipeline weighted value
  const crmWeightedValue = useMemo(() => {
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    return opportunities
      .filter((o) => !o.won_at && !o.lost_at)
      .reduce((sum, o) => {
        const stage = stageMap.get(o.stage_id);
        const prob = stage ? Number(stage.probability) / 100 : 0;
        return sum + Number(o.estimated_value) * prob;
      }, 0);
  }, [opportunities, stages]);

  return {
    // Cashflow
    entries,
    cashflowTotals: totals,
    // Contracts
    activeContractsCount: activeContracts.length,
    monthlyContractValue,
    // Payroll
    avgMonthlyPayroll,
    // Liabilities
    liabilityTotals: liabTotals,
    contingenciasProvaveis: liabTotals.contingencias_provaveis,
    // Runway
    runway,
    monthlyBurn,
    // CRM
    crmWeightedValue,
    // Alerts
    alerts,
    // Loading
    isLoading: cashflowLoading || contractsLoading || liabLoading || payrollLoading,
  };
}
