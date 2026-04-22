import { useCallback } from "react";
import { format, addMonths, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useContracts } from "@/hooks/useContracts";
import { usePlanningConfig } from "@/hooks/usePlanningConfig";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";
import { useLiabilities } from "@/hooks/useLiabilities";
import { useFinancialSummary } from "@/hooks/useFinancialSummary";
import { useBudget, useBudgetLines, BudgetLine } from "@/hooks/useBudget";
import { useCRMOpportunities, usePipelineStages } from "@/hooks/useCRM";
import { usePlanningScenarioContext } from "@/contexts/PlanningScenarioContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { generateProjectionsFromContract } from "@/lib/contractProjections";
import {
  PlanningFilters,
  EMPTY_PLANNING_FILTERS,
  entryMatchesFilters,
  contractMatchesFilters,
  hasAnyFilter,
} from "@/lib/planningFilters";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useHolding } from "@/contexts/HoldingContext";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(v);

interface PdfReportOptions {
  startDate: Date;
  endDate: Date;
  budgetVersionId: string | null;
  filters?: PlanningFilters;
}

/**
 * Builds and downloads a PDF that mirrors the Cockpit and the
 * Plan × Real × Projetado comparative for the chosen horizon.
 * Includes generation date, budget version, active scenario and any
 * operational filters (subsidiary, bank account, cost center) so the
 * exported document matches exactly what the user sees on screen.
 */
export function usePlanningPdfReport({
  startDate, endDate, budgetVersionId, filters = EMPTY_PLANNING_FILTERS,
}: PdfReportOptions) {
  const { currentOrg } = useOrganization();
  const { entries: rawEntries, materializedEntries: rawMaterialized, totals: rawTotals } = useCashFlow(startDate, endDate);
  const { contracts: rawContracts } = useContracts();
  const { config } = usePlanningConfig();
  const { avgMonthlyPayroll: rawAvgPayroll, payrollProjections: rawPayroll } = usePayrollProjections(startDate, endDate);
  const { totals: liabTotals } = useLiabilities();
  const { crmWeightedValue, alerts } = useFinancialSummary(startDate, endDate);
  const { versions, isLoadingVersions } = useBudget();
  const budgetLinesQuery = useBudgetLines(budgetVersionId);
  const { opportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();
  const { activeScenario, receitaFactor, custoFactor, stressExtraOutflow } = usePlanningScenarioContext();
  const { costCenters } = useCostCenters();
  const { allBankAccounts } = useBankAccounts();
  const { subsidiaryOrgs } = useHolding();

  const generatePdf = useCallback(() => {
    const budgetVersion = versions.find((v) => v.id === budgetVersionId) ?? null;
    const budgetLines = (budgetLinesQuery.data ?? []) as BudgetLine[];

    // ===== Apply operational filters (mirror Cockpit & PlannedVsActual) =====
    const entries = rawEntries.filter((e) => entryMatchesFilters(e as any, filters));
    const materializedEntries = rawMaterialized.filter((e) => entryMatchesFilters(e as any, filters));
    const contracts = rawContracts.filter((c) => contractMatchesFilters(c as any, filters));
    const payrollProjections = filters.costCenterId
      ? rawPayroll.filter((p) => (p as any).cost_center_id === filters.costCenterId)
      : rawPayroll;

    // Recompute totals over filtered entries
    let entradasTot = 0, saidasTot = 0;
    for (const e of entries) {
      const v = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") entradasTot += v;
      else saidasTot += v;
    }
    const totals = { entradas: entradasTot, saidas: saidasTot, saldo: entradasTot - saidasTot };

    // ============= Aggregations (mirroring Cockpit & PlannedVsActual) =============
    const monthly: Record<string, { entradas: number; saidas: number }> = {};
    let cursor = startOfMonth(startDate);
    while (!isAfter(cursor, endDate)) {
      monthly[format(cursor, "yyyy-MM")] = { entradas: 0, saidas: 0 };
      cursor = addMonths(cursor, 1);
    }
    for (const e of entries) {
      const key = e.data_prevista.slice(0, 7);
      if (monthly[key]) {
        const val = Number(e.valor_realizado ?? e.valor_previsto);
        if (e.tipo === "entrada") monthly[key].entradas += val;
        else monthly[key].saidas += val;
      }
    }

    const monthsCount = Math.max(1, Object.keys(monthly).length);
    const stressPerMonth = stressExtraOutflow / monthsCount;
    const avgMonthlySaida =
      Object.values(monthly).reduce((s, m) => s + m.saidas, 0) / monthsCount;
    const runway =
      avgMonthlySaida > 0 ? Math.floor(totals.saldo / avgMonthlySaida) : Infinity;
    const activeContracts = contracts.filter((c) => c.status === "Ativo").length;
    const avgMonthlyPayroll = filters.costCenterId
      ? payrollProjections.reduce((s, p) => s + Number(p.valor_previsto), 0) / monthsCount
      : rawAvgPayroll;

    // Budget aggregation by month
    const budgetedByMonth: Record<string, { receita: number; gasto: number }> = {};
    for (const line of budgetLines) {
      const key = line.month.slice(0, 7);
      if (!budgetedByMonth[key]) budgetedByMonth[key] = { receita: 0, gasto: 0 };
      if (line.tipo === "receita") {
        budgetedByMonth[key].receita += Number(line.valor_orcado);
      } else {
        budgetedByMonth[key].gasto += Number(line.valor_orcado);
      }
    }

    // ===== Realizado (somente lançamentos efetivamente realizados) =====
    // Evita dupla contagem com Projetado, que é construído a partir das mesmas fontes virtuais.
    const realizedByMonth: Record<string, { entradas: number; saidas: number }> = {};
    for (const key of Object.keys(monthly)) realizedByMonth[key] = { entradas: 0, saidas: 0 };
    for (const e of materializedEntries) {
      const isRealized =
        e.valor_realizado != null ||
        e.status === "pago" ||
        e.status === "recebido" ||
        e.status === "conciliado";
      if (!isRealized) continue;
      const key = e.data_prevista.slice(0, 7);
      if (!realizedByMonth[key]) continue;
      const val = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") realizedByMonth[key].entradas += val;
      else realizedByMonth[key].saidas += val;
    }

    // ===== Projetado por mês — mesma granularidade, sem dupla contagem =====
    const projectedByMonth: Record<string, { receita: number; gasto: number }> = {};
    for (const key of Object.keys(monthly)) projectedByMonth[key] = { receita: 0, gasto: 0 };

    // 1. Contratos: usa o mesmo motor que o Fluxo de Caixa (respeita janela e intervalo)
    for (const c of contracts) {
      const projs = generateProjectionsFromContract(c, startDate, endDate);
      for (const p of projs) {
        const key = p.data_prevista.slice(0, 7);
        if (!projectedByMonth[key]) continue;
        const v = Number(p.valor_previsto);
        if (p.tipo === "entrada") projectedByMonth[key].receita += v;
        else projectedByMonth[key].gasto += v;
      }
    }

    // 2. DP/Folha — projeções já vêm com data_prevista correta por mês
    for (const p of payrollProjections) {
      const key = String(p.data_prevista).slice(0, 7);
      if (!projectedByMonth[key]) continue;
      projectedByMonth[key].gasto += Number(p.valor_previsto);
    }

    // 3. CRM ponderado — concentra em estimated_close_date; sem data, distribui no horizonte
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    const openOpps = opportunities.filter((o) => !o.won_at && !o.lost_at);
    let undatedWeighted = 0;
    for (const o of openOpps) {
      const stage = stageMap.get(o.stage_id);
      const prob = stage ? Number(stage.probability) / 100 : 0;
      const weighted = Number(o.estimated_value) * prob;
      if (weighted <= 0) continue;
      if (o.estimated_close_date) {
        const key = String(o.estimated_close_date).slice(0, 7);
        if (projectedByMonth[key]) projectedByMonth[key].receita += weighted;
      } else {
        undatedWeighted += weighted;
      }
    }
    if (undatedWeighted > 0) {
      const perMonth = undatedWeighted / monthsCount;
      for (const key of Object.keys(projectedByMonth)) {
        projectedByMonth[key].receita += perMonth;
      }
    }

    // ============= Build PDF =============
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const footerHeight = 28; // espaço reservado ao rodapé em todas as páginas
    const bottomLimit = pageHeight - margin - footerHeight; // limite seguro para conteúdo
    let y = margin;

    // Garante que há `needed` pontos disponíveis antes de desenhar; senão, nova página.
    const ensureSpace = (needed: number) => {
      if (y + needed > bottomLimit) {
        doc.addPage();
        y = margin;
      }
    };

    // ----- Header -----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Planejamento Financeiro", margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    const orgName = currentOrg?.name ?? "—";
    const horizon = `${format(startDate, "MMM/yyyy", { locale: ptBR })} — ${format(
      endDate,
      "MMM/yyyy",
      { locale: ptBR }
    )}`;
    const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const versionLine = budgetVersion
      ? `${budgetVersion.name} (${budgetVersion.status})`
      : "Sem versão de orçamento selecionada";
    const scenarioLine = activeScenario
      ? `${activeScenario.name} · ${activeScenario.variacao_receita > 0 ? "+" : ""}${activeScenario.variacao_receita}% rec / ${activeScenario.variacao_custos > 0 ? "+" : ""}${activeScenario.variacao_custos}% custo`
      : "Base";

    // Filtros operacionais aplicados — refletem exatamente o que está em tela
    const filterParts: string[] = [];
    if (filters.subsidiaryOrgId) {
      const sub = subsidiaryOrgs.find((s) => s.id === filters.subsidiaryOrgId);
      filterParts.push(`Unidade: ${sub?.name ?? filters.subsidiaryOrgId.slice(0, 8)}`);
    }
    if (filters.bankAccountId) {
      const ba = allBankAccounts.find((b) => b.id === filters.bankAccountId);
      filterParts.push(`Conta: ${ba?.nome ?? filters.bankAccountId.slice(0, 8)}`);
    }
    if (filters.costCenterId) {
      const cc = costCenters.find((c) => c.id === filters.costCenterId);
      filterParts.push(`CC: ${cc ? `${cc.code} ${cc.name}` : filters.costCenterId.slice(0, 8)}`);
    }
    const filtersLine = filterParts.length > 0 ? filterParts.join(" · ") : "Nenhum";

    doc.text(`Organização: ${orgName}`, margin, y); y += 12;
    doc.text(`Horizonte: ${horizon}`, margin, y); y += 12;
    doc.text(`Versão de orçamento: ${versionLine}`, margin, y); y += 12;
    doc.text(`Cenário ativo: ${scenarioLine}`, margin, y); y += 12;
    doc.text(`Filtros aplicados: ${filtersLine}`, margin, y); y += 12;
    doc.text(`Gerado em: ${generatedAt}`, margin, y); y += 18;
    doc.setTextColor(0);

    // Divider
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;

    // ----- Cockpit KPIs -----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Cockpit Executivo", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y + 4,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [40, 50, 70], textColor: 255 },
      head: [["Indicador", "Valor"]],
      body: [
        ["Saldo projetado", fmt(totals.saldo)],
        ["Receitas projetadas", fmt(totals.entradas)],
        ["Despesas projetadas", fmt(totals.saidas)],
        ["Burn mensal médio", fmt(avgMonthlySaida)],
        ["Runway", runway === Infinity ? "∞" : `${runway} meses`],
        ["Custo folha/mês", fmt(avgMonthlyPayroll)],
        ["Contratos ativos", String(activeContracts)],
        ["Passivos (total)", fmt(liabTotals.total)],
        ["Pipeline ponderado (CRM)", fmt(crmWeightedValue)],
        ["Saldo mínimo configurado", fmt(config?.saldo_minimo ?? 0)],
        ["Alerta de runway (meses)", String(config?.runway_alerta_meses ?? 3)],
      ],
      margin: { left: margin, right: margin, bottom: margin + footerHeight },
      // Repete o cabeçalho da tabela em cada página e evita cortar linhas
      showHead: "everyPage",
      rowPageBreak: "avoid",
      pageBreak: "auto",
    });
    y = (doc as any).lastAutoTable.finalY + 18;

    // ----- Strategic Alerts -----
    if (alerts.length > 0) {
      ensureSpace(40); // título + primeira linha
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Alertas Estratégicos (${alerts.length})`, margin, y);
      autoTable(doc, {
        startY: y + 6,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [40, 50, 70], textColor: 255 },
        head: [["Tipo", "Categoria", "Título", "Descrição"]],
        body: alerts.map((a) => [
          a.type === "danger" ? "Crítico" : a.type === "warning" ? "Atenção" : "Info",
          a.category,
          a.title,
          a.description,
        ]),
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 70 },
          2: { cellWidth: 160 },
          3: { cellWidth: "auto" },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ----- Plan × Real × Projetado -----
    doc.addPage();
    y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Plan × Real × Projetado (mensal)", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(
      "Valores líquidos por mês: Receita - Gasto. Variação compara Realizado vs Orçado.",
      margin,
      y + 12
    );
    doc.setTextColor(0);

    const months = Object.keys(monthly).sort();
    const rows = months.map((key) => {
      const realized = realizedByMonth[key] ?? { entradas: 0, saidas: 0 };
      const budgeted = budgetedByMonth[key] ?? { receita: 0, gasto: 0 };
      const projected = projectedByMonth[key] ?? { receita: 0, gasto: 0 };
      const orcado = budgeted.receita - budgeted.gasto;
      const cenario =
        budgeted.receita * receitaFactor - (budgeted.gasto * custoFactor + stressPerMonth);
      const projetado = projected.receita - projected.gasto;
      const realizado = realized.entradas - realized.saidas;
      const diferenca = realizado - orcado;
      const variacao = orcado !== 0 ? ((realizado - orcado) / Math.abs(orcado)) * 100 : 0;
      return [
        format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
        fmt(orcado),
        activeScenario && activeScenario.type !== "base" ? fmt(cenario) : "—",
        fmt(projetado),
        fmt(realizado),
        fmt(diferenca),
        `${variacao >= 0 ? "+" : ""}${variacao.toFixed(1)}%`,
      ];
    });

    autoTable(doc, {
      startY: y + 22,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 5, halign: "right" },
      headStyles: { fillColor: [40, 50, 70], textColor: 255, halign: "center" },
      columnStyles: { 0: { halign: "left", cellWidth: 60 } },
      head: [["Mês", "Orçado", "Sob Cenário", "Projetado", "Realizado", "Diferença", "Variação"]],
      body: rows,
      margin: { left: margin, right: margin },
    });

    // ----- Footer on every page -----
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        `Colli FinCore · ${orgName} · ${generatedAt}`,
        margin,
        doc.internal.pageSize.getHeight() - 18
      );
      doc.text(
        `Página ${i}/${pageCount}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 18,
        { align: "right" }
      );
    }

    const fileName = `planejamento_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
    doc.save(fileName);

    // Retorna metadados de auditoria para que o chamador possa registrar
    // a exportação no histórico (mesmos textos exibidos no cabeçalho do PDF).
    return {
      fileName,
      generatedAt: new Date(),
      filtersSummary: filtersLine,
      scenarioName: activeScenario?.name ?? null,
      scenarioId: activeScenario?.id ?? null,
      budgetVersionId: budgetVersion?.id ?? null,
      budgetVersionName: budgetVersion?.name ?? null,
    };
  }, [
    versions,
    budgetVersionId,
    budgetLinesQuery.data,
    rawEntries,
    rawMaterialized,
    rawContracts,
    rawPayroll,
    rawAvgPayroll,
    rawTotals,
    config,
    liabTotals.total,
    crmWeightedValue,
    alerts,
    opportunities,
    stages,
    activeScenario,
    receitaFactor,
    custoFactor,
    stressExtraOutflow,
    startDate,
    endDate,
    currentOrg?.name,
    filters,
    subsidiaryOrgs,
    allBankAccounts,
    costCenters,
  ]);

  const isReady = !isLoadingVersions && !budgetLinesQuery.isLoading;

  return { generatePdf, isReady };
}
