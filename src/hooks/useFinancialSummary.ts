import { useMemo, useCallback } from "react";
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
import {
  PlanningFilters,
  EMPTY_PLANNING_FILTERS,
  entryMatchesFilters,
  contractMatchesFilters,
} from "@/lib/planningFilters";

export type AlertCategory =
  | "runway"
  | "saldo_minimo"
  | "passivo"
  | "contrato"
  | "crm"
  | "divergencia";

export type PlanningTab =
  | "cockpit"
  | "orcamento"
  | "cenarios-risco"
  | "operacional";

export interface Alert {
  type: "warning" | "danger" | "info";
  category: AlertCategory;
  title: string;
  description: string;
  /** Tab dentro de /planejamento que resolve o alerta */
  actionTab: PlanningTab;
  /** Rótulo curto do botão de ação (ex.: "Abrir Cenários") */
  actionLabel: string;
}

export function useFinancialSummary(
  rangeFrom: Date,
  rangeTo: Date,
  filters: PlanningFilters = EMPTY_PLANNING_FILTERS,
) {
  const { entries: rawEntries, totals: rawTotals, isLoading: cashflowLoading } = useCashFlow(rangeFrom, rangeTo);
  const { contracts: rawContracts, isLoading: contractsLoading } = useContracts();
  const { liabilities: rawLiabilities, isLoading: liabLoading } = useLiabilities();
  const { config: planConfig } = usePlanningConfig();
  const { avgMonthlyPayroll, isLoading: payrollLoading } = usePayrollProjections(rangeFrom, rangeTo);
  const { opportunities: rawOpportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();

  // Apply operational filters consistently to every downstream aggregation.
  const entries = useMemo(
    () => rawEntries.filter((e) => entryMatchesFilters(e as any, filters)),
    [rawEntries, filters],
  );
  const contracts = useMemo(
    () => rawContracts.filter((c) => contractMatchesFilters(c as any, filters)),
    [rawContracts, filters],
  );
  const liabilities = useMemo(
    () => rawLiabilities.filter((l) => contractMatchesFilters(l as any, filters)),
    [rawLiabilities, filters],
  );
  // CRM has no cost_center dimension — apply only org-level filter.
  const opportunities = useMemo(() => {
    if (!filters.subsidiaryOrgId) return rawOpportunities;
    return rawOpportunities.filter(
      (o: any) => o.organization_id === filters.subsidiaryOrgId,
    );
  }, [rawOpportunities, filters.subsidiaryOrgId]);

  // Recompute totals when filters narrow the dataset.
  const totals = useMemo(() => {
    if (entries === rawEntries) return rawTotals;
    let entradas = 0, saidas = 0;
    for (const e of entries) {
      const v = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") entradas += v;
      else saidas += v;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [entries, rawEntries, rawTotals]);

  // Filtered liability totals (subset of useLiabilities().totals).
  const liabTotals = useMemo(() => {
    let total = 0;
    let judiciais = 0;
    let contingencias_provaveis = 0;
    for (const l of liabilities) {
      const v = Number(l.valor_atualizado);
      total += v;
      if (l.status === "judicial") judiciais += v;
      if (l.probabilidade === "provavel") contingencias_provaveis += v;
    }
    return { total, judiciais, contingencias_provaveis };
  }, [liabilities]);

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
  const now = useMemo(() => new Date(), []);
  const curMonthKey = useMemo(() => format(now, "yyyy-MM"), [now]);

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
        category: "contrato",
        title: `${expiring.length} contrato(s) vencem em 30 dias`,
        description: expiring.map((c) => c.nome).join(", "),
        actionTab: "operacional",
        actionLabel: "Revisar contratos",
      });
    }

    // Low runway
    const alertaRunway = planConfig?.runway_alerta_meses ?? 3;
    if (runway !== Infinity && runway <= alertaRunway) {
      list.push({
        type: "danger",
        category: "runway",
        title: `Runway de apenas ${runway} mês(es)`,
        description: `Saldo atual dividido pelo burn rate mensal médio (${monthlyBurn.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/mês) está abaixo do alerta configurado de ${alertaRunway} meses.`,
        actionTab: "cenarios-risco",
        actionLabel: "Simular cenário",
      });
    }

    // Below minimum balance
    const saldoMinimo = planConfig?.saldo_minimo ?? 0;
    if (saldoMinimo > 0 && totals.saldo < saldoMinimo) {
      list.push({
        type: "danger",
        category: "saldo_minimo",
        title: "Saldo projetado abaixo do mínimo",
        description: `Saldo projetado de ${totals.saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} está abaixo do mínimo configurado de ${saldoMinimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}.`,
        actionTab: "orcamento",
        actionLabel: "Revisar orçamento",
      });
    }

    // Divergência: saídas projetadas excedem entradas projetadas no horizonte
    if (totals.entradas > 0 && totals.saidas > totals.entradas) {
      const gap = totals.saidas - totals.entradas;
      const pct = (gap / totals.entradas) * 100;
      if (pct >= 10) {
        list.push({
          type: pct >= 25 ? "danger" : "warning",
          category: "divergencia",
          title: `Saídas excedem entradas em ${pct.toFixed(0)}% no horizonte`,
          description: `Projeção indica déficit de ${gap.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}. Avalie cortes ou novas receitas.`,
          actionTab: "cenarios-risco",
          actionLabel: "Avaliar cenário",
        });
      }
    }

    // Judicial liabilities
    const judiciais = liabilities.filter((l) => l.status === "judicial");
    if (judiciais.length > 0) {
      list.push({
        type: "warning",
        category: "passivo",
        title: `${judiciais.length} passivo(s) em fase judicial`,
        description: `Valor total: ${judiciais.reduce((s, l) => s + Number(l.valor_atualizado), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}. Considere o impacto no cenário de Stress.`,
        actionTab: "cenarios-risco",
        actionLabel: "Ver passivos",
      });
    }

    // CRM: opportunities without recent action
    const staleOpps = opportunities.filter((o) => !o.won_at && !o.lost_at && !o.updated_at);
    if (staleOpps.length > 0) {
      list.push({
        type: "info",
        category: "crm",
        title: `${staleOpps.length} oportunidade(s) CRM sem ação recente`,
        description: "Verifique o pipeline comercial para atualizar o status.",
        actionTab: "operacional",
        actionLabel: "Abrir pipeline",
      });
    }

    return list;
  }, [contracts, liabilities, runway, monthlyBurn, totals.saldo, totals.entradas, totals.saidas, planConfig, opportunities, now]);

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
    liabTotals,
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
