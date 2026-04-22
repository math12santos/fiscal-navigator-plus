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
}

/**
 * Builds and downloads a PDF that mirrors the Cockpit and the
 * Plan × Real × Projetado comparative for the chosen horizon.
 * Includes generation date, budget version and active scenario.
 */
export function usePlanningPdfReport({ startDate, endDate, budgetVersionId }: PdfReportOptions) {
  const { currentOrg } = useOrganization();
  const { entries, totals } = useCashFlow(startDate, endDate);
  const { contracts } = useContracts();
  const { config } = usePlanningConfig();
  const { avgMonthlyPayroll, payrollProjections } = usePayrollProjections(startDate, endDate);
  const { totals: liabTotals } = useLiabilities();
  const { crmWeightedValue, alerts } = useFinancialSummary(startDate, endDate);
  const { versions, isLoadingVersions } = useBudget();
  const budgetLinesQuery = useBudgetLines(budgetVersionId);
  const { opportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();
  const { activeScenario, receitaFactor, custoFactor, stressExtraOutflow } = usePlanningScenarioContext();

  const generatePdf = useCallback(() => {
    const budgetVersion = versions.find((v) => v.id === budgetVersionId) ?? null;
    const budgetLines = (budgetLinesQuery.data ?? []) as BudgetLine[];

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

    // Projected (contracts + payroll + CRM weighted)
    const monthlyContractRevenue = contracts
      .filter((c) => c.status === "Ativo" && (c.tipo === "Receita" || c.tipo === "receita"))
      .reduce((sum, c) => {
        const v = Number(c.valor);
        if (c.tipo_recorrencia === "mensal") return sum + v;
        if (c.tipo_recorrencia === "bimestral") return sum + v / 2;
        if (c.tipo_recorrencia === "trimestral") return sum + v / 3;
        if (c.tipo_recorrencia === "semestral") return sum + v / 6;
        if (c.tipo_recorrencia === "anual") return sum + v / 12;
        return sum;
      }, 0);
    const monthlyContractCost = contracts
      .filter((c) => c.status === "Ativo" && c.tipo !== "Receita" && c.tipo !== "receita")
      .reduce((sum, c) => {
        const v = Number(c.valor);
        if (c.tipo_recorrencia === "mensal") return sum + v;
        if (c.tipo_recorrencia === "bimestral") return sum + v / 2;
        if (c.tipo_recorrencia === "trimestral") return sum + v / 3;
        if (c.tipo_recorrencia === "semestral") return sum + v / 6;
        if (c.tipo_recorrencia === "anual") return sum + v / 12;
        return sum;
      }, 0);

    const stageMap = new Map(stages.map((s) => [s.id, s]));
    const totalPipelineWeighted = opportunities
      .filter((o) => !o.won_at && !o.lost_at)
      .reduce((sum, o) => {
        const s = stageMap.get(o.stage_id);
        const prob = s ? Number(s.probability) / 100 : 0;
        return sum + Number(o.estimated_value) * prob;
      }, 0);
    const projMonthsCount = Math.max(1, payrollProjections.length || monthsCount);
    const crmPerMonth = totalPipelineWeighted / projMonthsCount;

    // ============= Build PDF =============
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    let y = margin;

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

    doc.text(`Organização: ${orgName}`, margin, y); y += 12;
    doc.text(`Horizonte: ${horizon}`, margin, y); y += 12;
    doc.text(`Versão de orçamento: ${versionLine}`, margin, y); y += 12;
    doc.text(`Cenário ativo: ${scenarioLine}`, margin, y); y += 12;
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
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 18;

    // ----- Strategic Alerts -----
    if (alerts.length > 0) {
      if (y > 720) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Alertas Estratégicos (${alerts.length})`, margin, y);
      autoTable(doc, {
        startY: y + 6,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 5 },
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
      const realized = monthly[key];
      const budgeted = budgetedByMonth[key] ?? { receita: 0, gasto: 0 };
      const orcado = budgeted.receita - budgeted.gasto;
      const cenario =
        budgeted.receita * receitaFactor - (budgeted.gasto * custoFactor + stressPerMonth);
      const projetado =
        monthlyContractRevenue + crmPerMonth - (monthlyContractCost + avgMonthlyPayroll);
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
  }, [
    versions,
    budgetVersionId,
    budgetLinesQuery.data,
    entries,
    totals,
    contracts,
    config,
    avgMonthlyPayroll,
    payrollProjections.length,
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
  ]);

  const isReady = !isLoadingVersions && !budgetLinesQuery.isLoading;

  return { generatePdf, isReady };
}
