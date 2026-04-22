import { useMemo } from "react";
import { format, addMonths, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useBudget, useBudgetLines, BudgetLine } from "@/hooks/useBudget";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";
import { useContracts } from "@/hooks/useContracts";
import { useCRMOpportunities, usePipelineStages } from "@/hooks/useCRM";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePlanningScenarioContext } from "@/contexts/PlanningScenarioContext";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  startDate: Date;
  endDate: Date;
  budgetVersionId: string | null;
}

export default function PlannedVsActual({ startDate, endDate, budgetVersionId }: Props) {
  const { entries } = useCashFlow(startDate, endDate);
  const budgetLinesQuery = useBudgetLines(budgetVersionId);
  const { accounts } = useChartOfAccounts();
  const { avgMonthlyPayroll, payrollProjections } = usePayrollProjections(startDate, endDate);
  const { contracts } = useContracts();
  const { opportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();
  const { activeScenario, receitaFactor, custoFactor, stressExtraOutflow } = usePlanningScenarioContext();
  const isBaseScenario = !activeScenario || activeScenario.type === "base";
  // Stress contribution distributed evenly across months for visualization
  const monthsCount = useMemo(() => {
    let n = 0;
    let c = startOfMonth(startDate);
    while (!isAfter(c, endDate)) { n++; c = addMonths(c, 1); }
    return Math.max(1, n);
  }, [startDate, endDate]);
  const stressPerMonth = stressExtraOutflow / monthsCount;

  const budgetLines = (budgetLinesQuery.data ?? []) as BudgetLine[];

  // DP realized costs by month (from cashflow entries with source "dp")
  const dpByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if ((e as any).source === "dp" && e.tipo === "saida") {
        const key = e.data_prevista.slice(0, 7);
        map[key] = (map[key] ?? 0) + Number(e.valor_realizado ?? e.valor_previsto);
      }
    }
    return map;
  }, [entries]);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Aggregate realized by month
  const realizedByMonth = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number }> = {};
    for (const e of entries) {
      const key = e.data_prevista.slice(0, 7);
      if (!map[key]) map[key] = { entradas: 0, saidas: 0 };
      const val = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") map[key].entradas += val;
      else map[key].saidas += val;
    }
    return map;
  }, [entries]);

  // Aggregate budgeted by month
  const budgetedByMonth = useMemo(() => {
    const map: Record<string, { receita: number; gasto: number }> = {};
    for (const line of budgetLines) {
      const key = (line as BudgetLine).month.slice(0, 7);
      if (!map[key]) map[key] = { receita: 0, gasto: 0 };
      if ((line as BudgetLine).tipo === "receita") {
        map[key].receita += Number((line as BudgetLine).valor_orcado);
      } else {
        map[key].gasto += Number((line as BudgetLine).valor_orcado);
      }
    }
    return map;
  }, [budgetLines]);

  // Projected (contracts recurring monthly + payroll + CRM weighted)
  const projectedByMonth = useMemo(() => {
    const map: Record<string, { receita: number; gasto: number }> = {};

    // Active recurring contracts → monthly value
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

    // CRM weighted pipeline → monthly fraction over horizon
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    const totalPipelineWeighted = opportunities
      .filter((o) => !o.won_at && !o.lost_at)
      .reduce((sum, o) => {
        const s = stageMap.get(o.stage_id);
        const prob = s ? Number(s.probability) / 100 : 0;
        return sum + Number(o.estimated_value) * prob;
      }, 0);

    let cursor = startOfMonth(startDate);
    const monthsCount = Math.max(1, payrollProjections.length || 1);
    const crmPerMonth = totalPipelineWeighted / monthsCount;

    while (!isAfter(cursor, endDate)) {
      const key = format(cursor, "yyyy-MM");
      map[key] = {
        receita: monthlyContractRevenue + crmPerMonth,
        gasto: monthlyContractCost + avgMonthlyPayroll,
      };
      cursor = addMonths(cursor, 1);
    }
    return map;
  }, [contracts, opportunities, stages, avgMonthlyPayroll, payrollProjections.length, startDate, endDate]);

  // Chart data
  const chartData = useMemo(() => {
    const data: any[] = [];
    let cursor = startOfMonth(startDate);
    while (!isAfter(cursor, endDate)) {
      const key = format(cursor, "yyyy-MM");
      const realized = realizedByMonth[key] ?? { entradas: 0, saidas: 0 };
      const budgeted = budgetedByMonth[key] ?? { receita: 0, gasto: 0 };
      const projected = projectedByMonth[key] ?? { receita: 0, gasto: 0 };
      data.push({
        mes: format(cursor, "MMM/yy", { locale: ptBR }),
        monthKey: key,
        "Realizado (Entrada)": realized.entradas,
        "Realizado (Saída)": -realized.saidas,
        "Orçado (Receita)": budgeted.receita,
        "Orçado (Gasto)": -budgeted.gasto,
        "Projetado (Receita)": projected.receita,
        "Projetado (Gasto)": -projected.gasto,
      });
      cursor = addMonths(cursor, 1);
    }
    return data;
  }, [realizedByMonth, budgetedByMonth, projectedByMonth, startDate, endDate]);

  // Variance table by month
  const varianceData = useMemo(() => {
    return chartData.map((d) => {
      const realizado = d["Realizado (Entrada)"] + d["Realizado (Saída)"];
      const orcado = d["Orçado (Receita)"] + d["Orçado (Gasto)"];
      const projetado = d["Projetado (Receita)"] + d["Projetado (Gasto)"];
      const dp = dpByMonth[d.monthKey] ?? 0;
      const variacao = orcado !== 0 ? ((realizado - orcado) / Math.abs(orcado)) * 100 : 0;
      return {
        mes: d.mes,
        orcado,
        realizado,
        projetado,
        dp,
        diferenca: realizado - orcado,
        variacao,
      };
    });
  }, [chartData, dpByMonth]);

  if (!budgetVersionId) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          Selecione uma versão de orçamento para comparar com o realizado.
        </p>
        <p className="text-xs text-muted-foreground">
          Crie um orçamento na aba "Orçamento" para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Orçado × Realizado × Projetado</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Projetado combina contratos recorrentes ativos, projeções de folha (DP) e pipeline ponderado do CRM.
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: number) => fmt(Math.abs(v))}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
            <Bar dataKey="Orçado (Receita)" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Projetado (Receita)" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Realizado (Entrada)" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Orçado (Gasto)" fill="hsl(var(--warning) / 0.4)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="Projetado (Gasto)" fill="hsl(var(--warning) / 0.7)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="Realizado (Saída)" fill="hsl(var(--destructive))" radius={[0, 0, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Variance Table */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Variação por Mês</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Orçado</TableHead>
              <TableHead className="text-right">Projetado</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Custo DP</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-right">Variação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {varianceData.map((row) => (
              <TableRow key={row.mes}>
                <TableCell className="font-medium">{row.mes}</TableCell>
                <TableCell className="text-right">{fmt(row.orcado)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{fmt(row.projetado)}</TableCell>
                <TableCell className="text-right">{fmt(row.realizado)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{fmt(row.dp)}</TableCell>
                <TableCell className={`text-right font-medium ${row.diferenca >= 0 ? "text-success" : "text-destructive"}`}>
                  {fmt(row.diferenca)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={row.variacao >= 0 ? "default" : "destructive"} className="text-xs">
                    {row.variacao >= 0 ? "+" : ""}{row.variacao.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
