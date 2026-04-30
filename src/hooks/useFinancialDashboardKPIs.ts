import { useMemo } from "react";
import { addMonths, format, startOfMonth, subMonths, differenceInMonths } from "date-fns";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useContracts } from "@/hooks/useContracts";
import { useLiabilities } from "@/hooks/useLiabilities";
import { useEmployees } from "@/hooks/useDP";
import { useCRMClients, useCRMOpportunities } from "@/hooks/useCRM";
import { useFinanceiroAvgTerms } from "@/hooks/useFinanceiroAvgTerms";
import {
  DataCapability,
  KPI_REGISTRY,
  KpiDefinition,
} from "@/components/financeiro/dashboard/kpiRegistry";

export type KpiStatus = "ok" | "partial" | "missing" | "loading";

export interface KpiResult {
  status: KpiStatus;
  /** valor numérico (currency, days, ratio, number) ou percent (0–1) */
  value: number | null;
  /** texto auxiliar (ex.: "12 meses considerados"). */
  hint?: string;
  /** lista de capacidades faltantes (humanizadas). */
  missingReasons: string[];
  /** delta vs. período anterior (-1..+inf), null se indisponível */
  delta?: number | null;
}

export interface DashboardKPIData {
  results: Record<string, KpiResult>;
  capabilities: Record<DataCapability, boolean>;
  isLoading: boolean;
  windowMonths: number;
  /** Receita do período (referência usada por vários KPIs). */
  revenueGross: number;
  cashBalance: number;
}

const CAPABILITY_LABELS: Record<DataCapability, string> = {
  entradas_realizadas: "recebimentos efetivamente realizados",
  saidas_realizadas: "pagamentos efetivamente realizados",
  historico_2_meses: "ao menos 2 meses de histórico",
  tributos_classificados: "despesas classificadas como tributos sobre vendas",
  cmv_classificado: "despesas classificadas como CMV/CSP",
  opex_classificada: "despesas classificadas como OPEX",
  depreciacao_registrada: "lançamentos de depreciação/amortização",
  juros_classificados: "despesas classificadas como juros",
  ir_classificado: "lançamentos de Imposto de Renda",
  contratos_recorrentes: "contratos recorrentes ativos",
  saldo_bancario: "contas bancárias com saldo cadastrado",
  contas_a_pagar: "contas a pagar registradas",
  contas_a_receber: "contas a receber registradas",
  passivos_registrados: "passivos cadastrados",
  passivos_onerosos: "passivos onerosos (com taxa de juros) cadastrados",
  headcount: "colaboradores ativos cadastrados",
  crm_clientes: "clientes ativos no CRM",
  crm_pipeline: "oportunidades ganhas no pipeline CRM",
  ticket_medio: "ticket médio calculável (transações de receita)",
};

/** Detecta se um lançamento é de tributo sobre vendas pela categoria/descrição. */
function isTaxOnSales(e: any): boolean {
  const blob = `${e.categoria ?? ""} ${e.descricao ?? ""} ${e.dp_sub_category ?? ""}`.toLowerCase();
  return /\b(tributo|imposto|iss|icms|pis|cofins|simples nacional|das)\b/.test(blob);
}
function isCMV(e: any): boolean {
  const blob = `${e.categoria ?? ""} ${e.descricao ?? ""}`.toLowerCase();
  return /\b(cmv|csp|custo das mercadorias|custo dos servi[cç]os|mat[eé]ria-prima|insumo)\b/.test(blob);
}
function isDepreciation(e: any): boolean {
  const blob = `${e.categoria ?? ""} ${e.descricao ?? ""}`.toLowerCase();
  return /\b(deprecia[cç][aã]o|amortiza[cç][aã]o)\b/.test(blob);
}
function isInterest(e: any): boolean {
  const blob = `${e.categoria ?? ""} ${e.descricao ?? ""}`.toLowerCase();
  return /\b(juros|encargos financeiros|iof)\b/.test(blob);
}
function isIncomeTax(e: any): boolean {
  const blob = `${e.categoria ?? ""} ${e.descricao ?? ""}`.toLowerCase();
  return /\b(irpj|csll|imposto de renda)\b/.test(blob);
}
function isMarketingOrSales(e: any): boolean {
  const blob = `${e.categoria ?? ""} ${e.descricao ?? ""}`.toLowerCase();
  return /\b(marketing|publicidade|comiss[aã]o|vendas|m[ií]dia|trade)\b/.test(blob);
}
/** OPEX = qualquer despesa que não seja CMV, depreciação, juros ou IR. */
function isOpex(e: any): boolean {
  return !isCMV(e) && !isDepreciation(e) && !isInterest(e) && !isIncomeTax(e) && !isTaxOnSales(e);
}

function monthlyContractAmount(c: any): number {
  const v = Number(c.valor) || 0;
  switch (c.tipo_recorrencia) {
    case "mensal": return v;
    case "bimestral": return v / 2;
    case "trimestral": return v / 3;
    case "semestral": return v / 6;
    case "anual": return v / 12;
    default: return 0;
  }
}

/**
 * Hook agregador para o Dashboard Financeiro.
 * Janela padrão: últimos 12 meses (a partir de hoje).
 * Retorna `KpiResult` para cada KPI do registry, junto com o mapa global
 * de capacidades de dados disponíveis na organização atual.
 */
export function useFinancialDashboardKPIs(windowMonths = 12): DashboardKPIData {
  const now = useMemo(() => new Date(), []);
  const rangeFrom = useMemo(() => startOfMonth(subMonths(now, windowMonths - 1)), [now, windowMonths]);
  const rangeTo = useMemo(() => addMonths(now, 0), [now]);

  const { entries, isLoading: cashLoading } = useCashFlow(rangeFrom, rangeTo);
  const { bankAccounts, isLoading: baLoading } = useBankAccounts();
  const { contracts, isLoading: contractsLoading } = useContracts();
  const { liabilities, isLoading: liabLoading } = useLiabilities();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { clients: crmClients, isLoading: crmLoading } = useCRMClients();
  const { opportunities, isLoading: oppLoading } = useCRMOpportunities();
  const pmrAvg = useFinanceiroAvgTerms("entrada", 90);
  const pmpAvg = useFinanceiroAvgTerms("saida", 90);

  const isLoading =
    cashLoading || baLoading || contractsLoading || liabLoading || empLoading || crmLoading || oppLoading;

  return useMemo<DashboardKPIData>(() => {
    // ----- Buckets básicos sobre cashflow -----
    const realized = entries.filter((e) => e.status === "pago" || e.status === "recebido");
    const entradas = realized.filter((e) => e.tipo === "entrada");
    const saidas = realized.filter((e) => e.tipo === "saida");

    const sum = (arr: any[]) =>
      arr.reduce((acc, e) => acc + Number(e.valor_realizado ?? e.valor_previsto ?? 0), 0);

    const revenueGross = sum(entradas);
    const taxesOnSales = sum(entradas.filter(isTaxOnSales)) + sum(saidas.filter(isTaxOnSales));
    const revenueNet = Math.max(0, revenueGross - taxesOnSales);

    const cmv = sum(saidas.filter(isCMV));
    const opex = sum(saidas.filter(isOpex));
    const depreciation = sum(saidas.filter(isDepreciation));
    const interest = sum(saidas.filter(isInterest));
    const incomeTax = sum(saidas.filter(isIncomeTax));
    const marketingSales = sum(saidas.filter(isMarketingOrSales));

    // Receita por mês para crescimento + DSO
    const revenueByMonth = new Map<string, number>();
    for (const e of entradas) {
      const key = format(new Date(e.data_realizada ?? e.data_prevista), "yyyy-MM");
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(e.valor_realizado ?? e.valor_previsto ?? 0));
    }
    const monthsWithRevenue = revenueByMonth.size;
    const sortedMonths = Array.from(revenueByMonth.keys()).sort();
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const growth =
      lastMonth && prevMonth && (revenueByMonth.get(prevMonth) || 0) > 0
        ? ((revenueByMonth.get(lastMonth)! - revenueByMonth.get(prevMonth)!) / revenueByMonth.get(prevMonth)!) * 100
        : null;

    const periodMonths = Math.max(1, differenceInMonths(rangeTo, rangeFrom) + 1);
    const burnRate = sum(saidas) / periodMonths;
    const cashBalance = (bankAccounts ?? [])
      .filter((b: any) => b.active)
      .reduce((acc: number, b: any) => acc + Number(b.saldo_atual || 0), 0);
    const runway = burnRate > 0 ? cashBalance / burnRate : Infinity;

    // Contratos recorrentes
    const activeRecurring = contracts.filter(
      (c) => c.status === "Ativo" && c.impacto_resultado === "receita" && monthlyContractAmount(c) > 0,
    );
    const mrr = activeRecurring.reduce((acc, c) => acc + monthlyContractAmount(c), 0);

    // Receivables / payables abertos
    const openAR = entries.filter(
      (e) => e.tipo === "entrada" && (e.status === "previsto" || e.status === "confirmado"),
    );
    const openAP = entries.filter(
      (e) => e.tipo === "saida" && (e.status === "previsto" || e.status === "confirmado"),
    );
    const totalOpenAR = sum(openAR);
    const totalOpenAP = sum(openAP);

    // Aging buckets de recebíveis em aberto (mesma janela 0-30/31-60/61-90/90+)
    const today = new Date();
    const arBuckets = [0, 0, 0, 0]; // 0-30, 31-60, 61-90, 90+
    for (const e of openAR) {
      const dueDate = new Date(e.data_prevista);
      const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
      if (daysLate < 0) continue; // ainda não vencido — não conta como inadimplência
      const v = Number(e.valor_previsto || 0);
      if (daysLate <= 30) arBuckets[0] += v;
      else if (daysLate <= 60) arBuckets[1] += v;
      else if (daysLate <= 90) arBuckets[2] += v;
      else arBuckets[3] += v;
    }
    const overdueTotal = arBuckets.reduce((a, b) => a + b, 0);

    // Concentração: top 5 clientes em recebíveis abertos
    const arByEntity = new Map<string, number>();
    for (const e of openAR) {
      const key = e.entity_id || "—";
      arByEntity.set(key, (arByEntity.get(key) || 0) + Number(e.valor_previsto || 0));
    }
    const top5AR = Array.from(arByEntity.values()).sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
    const concentracao = totalOpenAR > 0 ? (top5AR / totalOpenAR) * 100 : null;

    // DSO: (recebíveis em aberto / receita do período) × dias
    const periodDays = Math.max(1, differenceInMonths(rangeTo, rangeFrom) * 30 + 30);
    const dso = revenueGross > 0 ? (totalOpenAR / revenueGross) * periodDays : null;

    // Passivos
    const passivosTotal = liabilities.reduce((acc, l) => acc + Number(l.valor_atualizado || 0), 0);
    const passivosOnerosos = liabilities.filter((l) => Number((l as any).taxa_juros || 0) > 0);
    const passivosOnerososTotal = passivosOnerosos.reduce((acc, l) => acc + Number(l.valor_atualizado || 0), 0);
    const dividaLiquida = passivosOnerososTotal - cashBalance;
    const custoDividaPond =
      passivosOnerososTotal > 0
        ? (passivosOnerosos.reduce(
            (acc, l) => acc + Number(l.valor_atualizado || 0) * Number((l as any).taxa_juros || 0),
            0,
          ) /
            passivosOnerososTotal)
        : null;

    // EBITDA
    const operatingResult = revenueNet - cmv - opex;
    const ebitda = operatingResult + depreciation;
    const ebitdaAnualizado = (ebitda / periodMonths) * 12;

    // CRM
    const activeClients = (crmClients ?? []).filter((c: any) => c.active);
    const wonOpps = (opportunities ?? []).filter((o: any) => !!o.won_at);
    const lostOpps = (opportunities ?? []).filter((o: any) => !!o.lost_at);
    const wonCount = wonOpps.length;
    const churnPct = activeClients.length + lostOpps.length > 0
      ? (lostOpps.length / (activeClients.length + lostOpps.length)) * 100
      : null;

    const cac = wonCount > 0 ? marketingSales / wonCount : null;
    const ticketMedio = entradas.length > 0 ? revenueGross / entradas.length : null;
    const grossMargin = revenueNet > 0 ? (revenueNet - cmv) / revenueNet : null;
    const ltv = ticketMedio != null && grossMargin != null && grossMargin > 0
      ? ticketMedio * grossMargin * 12
      : null; // assume 12 meses de retenção média (simplificação)
    const ltvCac = ltv != null && cac != null && cac > 0 ? ltv / cac : null;
    const paybackCac = cac != null && ticketMedio != null && grossMargin != null && grossMargin > 0
      ? cac / (ticketMedio * grossMargin)
      : null;

    // Capacidades
    const capabilities: Record<DataCapability, boolean> = {
      entradas_realizadas: entradas.length > 0,
      saidas_realizadas: saidas.length > 0,
      historico_2_meses: monthsWithRevenue >= 2,
      tributos_classificados: taxesOnSales > 0,
      cmv_classificado: cmv > 0,
      opex_classificada: opex > 0,
      depreciacao_registrada: depreciation > 0,
      juros_classificados: interest > 0,
      ir_classificado: incomeTax > 0,
      contratos_recorrentes: activeRecurring.length > 0,
      saldo_bancario: (bankAccounts ?? []).some((b: any) => b.active),
      contas_a_pagar: openAP.length > 0,
      contas_a_receber: openAR.length > 0,
      passivos_registrados: liabilities.length > 0,
      passivos_onerosos: passivosOnerosos.length > 0,
      headcount: (employees ?? []).length > 0,
      crm_clientes: activeClients.length > 0,
      crm_pipeline: wonCount > 0,
      ticket_medio: entradas.length > 0,
    };

    function buildResult(def: KpiDefinition, value: number | null, hint?: string): KpiResult {
      const missing = def.requires.filter((r) => !capabilities[r]);
      if (missing.length > 0) {
        return {
          status: "missing",
          value: null,
          missingReasons: missing.map((m) => CAPABILITY_LABELS[m]),
          hint,
        };
      }
      if (value == null || !isFinite(value)) {
        return {
          status: "missing",
          value: null,
          missingReasons: ["dados insuficientes para calcular"],
          hint,
        };
      }
      return { status: "ok", value, hint, missingReasons: [] };
    }

    const headcount = (employees ?? []).length;
    const liquidezCorrente =
      passivosTotal > 0 ? (cashBalance + totalOpenAR) / passivosTotal : null;

    const calcs: Record<string, { value: number | null; hint?: string }> = {
      receita_bruta: { value: revenueGross, hint: `${entradas.length} recebimentos no período` },
      receita_liquida: { value: revenueNet, hint: `Bruta − ${taxesOnSales.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em tributos` },
      crescimento_receita: { value: growth, hint: `${lastMonth ?? "—"} vs. ${prevMonth ?? "—"}` },
      ticket_medio: { value: ticketMedio, hint: `${entradas.length} transações` },
      mrr: { value: mrr, hint: `${activeRecurring.length} contratos recorrentes` },
      arr: { value: mrr * 12, hint: "MRR × 12" },

      lucro_bruto: { value: revenueNet - cmv },
      margem_bruta: { value: grossMargin != null ? grossMargin * 100 : null },
      margem_operacional: { value: revenueNet > 0 ? (operatingResult / revenueNet) * 100 : null },
      ebitda: { value: ebitda, hint: `Op. (${operatingResult.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}) + Depreciação` },
      margem_ebitda: { value: revenueNet > 0 ? (ebitda / revenueNet) * 100 : null },
      margem_liquida: { value: revenueNet > 0 ? ((operatingResult - interest - incomeTax) / revenueNet) * 100 : null },

      saldo_caixa: { value: cashBalance, hint: `${(bankAccounts ?? []).filter((b: any) => b.active).length} contas ativas` },
      fluxo_caixa_operacional: { value: revenueGross - sum(saidas), hint: "Recebimentos − pagamentos no período" },
      burn_rate: { value: burnRate, hint: `Média mensal últimos ${periodMonths} meses` },
      runway: { value: runway === Infinity ? null : Math.round(runway), hint: runway === Infinity ? "Burn negativo" : `${Math.round(runway)} meses` },
      capital_giro: {
        value: pmrAvg.pmp_pmr_days && pmpAvg.pmp_pmr_days
          ? ((pmrAvg.pmp_pmr_days - pmpAvg.pmp_pmr_days) * (sum(saidas) / Math.max(1, periodMonths * 30)))
          : null,
        hint: `(PMR ${pmrAvg.pmp_pmr_days}d − PMP ${pmpAvg.pmp_pmr_days}d) × custo diário`,
      },
      liquidez_corrente: { value: liquidezCorrente },

      pmr: { value: pmrAvg.pmp_pmr_days || null, hint: `${pmrAvg.cobertura_pct}% cobertura` },
      inadimplencia_abc: { value: overdueTotal, hint: `0-30: ${arBuckets[0].toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} | 31-60: ${arBuckets[1].toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} | 61-90: ${arBuckets[2].toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}` },
      aging_recebiveis: { value: totalOpenAR, hint: `${openAR.length} títulos em aberto` },
      dso: { value: dso != null ? Math.round(dso) : null },
      taxa_recuperacao: { value: overdueTotal > 0 && revenueGross > 0 ? Math.min(100, (revenueGross / (revenueGross + overdueTotal)) * 100) : null },
      concentracao_recebiveis: { value: concentracao, hint: "Top 5 clientes" },

      pmp: { value: pmpAvg.pmp_pmr_days || null, hint: `${pmpAvg.cobertura_pct}% cobertura` },
      endividamento_geral: {
        value: passivosTotal > 0 ? (passivosTotal / (passivosTotal + cashBalance + totalOpenAR)) * 100 : null,
      },
      divida_liquida: { value: passivosOnerosos.length > 0 ? dividaLiquida : null },
      divida_ebitda: { value: ebitdaAnualizado > 0 && passivosOnerosos.length > 0 ? dividaLiquida / ebitdaAnualizado : null },
      cobertura_juros: { value: interest > 0 ? ebitda / interest : null },
      custo_divida: { value: custoDividaPond },

      opex_receita: { value: revenueGross > 0 ? (opex / revenueGross) * 100 : null },
      custo_fixo_mensal: { value: burnRate, hint: "Aproximação por burn médio" },
      ponto_equilibrio: {
        value: grossMargin != null && grossMargin > 0 ? burnRate / grossMargin : null,
        hint: "Custo Fixo / Margem de Contribuição",
      },
      produtividade_colab: { value: headcount > 0 ? revenueGross / headcount : null, hint: `${headcount} colaboradores` },
      custo_por_cliente: { value: activeClients.length > 0 ? opex / activeClients.length : null, hint: `${activeClients.length} clientes ativos` },
      margem_contribuicao: { value: grossMargin != null ? grossMargin * 100 : null },

      cac: { value: cac, hint: `${wonCount} clientes ganhos` },
      ltv: { value: ltv, hint: "Ticket × Margem × 12 meses (média estimada)" },
      ltv_cac: { value: ltvCac, hint: ltvCac != null ? (ltvCac >= 3 ? "Saudável (>3)" : "Abaixo do ideal") : undefined },
      payback_cac: { value: paybackCac },
      churn: { value: churnPct, hint: `${lostOpps.length} oportunidades perdidas` },
      expansion_revenue: { value: null, hint: "Necessário registrar reajustes em contratos" },
    };

    const results: Record<string, KpiResult> = {};
    for (const def of KPI_REGISTRY) {
      const calc = calcs[def.id];
      results[def.id] = buildResult(def, calc?.value ?? null, calc?.hint);
    }

    return {
      results,
      capabilities,
      isLoading,
      windowMonths: periodMonths,
      revenueGross,
      cashBalance,
    };
  }, [
    entries, bankAccounts, contracts, liabilities, employees, crmClients, opportunities,
    pmrAvg.pmp_pmr_days, pmrAvg.cobertura_pct, pmpAvg.pmp_pmr_days, pmpAvg.cobertura_pct,
    rangeFrom, rangeTo, isLoading,
  ]);
}
