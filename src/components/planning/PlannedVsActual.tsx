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
import { generateProjectionsFromContract } from "@/lib/contractProjections";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  startDate: Date;
  endDate: Date;
  budgetVersionId: string | null;
}

export default function PlannedVsActual({ startDate, endDate, budgetVersionId }: Props) {
  // IMPORTANT: use materializedEntries (DB rows) for Realizado.
  // `entries` from useCashFlow already merges recurrent contract projections + DP virtuals,
  // which would double-count against the Projetado series we recompute below.
  const { materializedEntries } = useCashFlow(startDate, endDate);
  const budgetLinesQuery = useBudgetLines(budgetVersionId);
  const { accounts } = useChartOfAccounts();
  const { payrollProjections } = usePayrollProjections(startDate, endDate);
  const { contracts } = useContracts();
  const { opportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();
  const { activeScenario, receitaFactor, custoFactor, stressExtraOutflow } = usePlanningScenarioContext();
  const isBaseScenario = !activeScenario || activeScenario.type === "base";

  // Horizon months — single source of truth for granularity & divisors
  const horizonMonths = useMemo(() => {
    const list: string[] = [];
    let c = startOfMonth(startDate);
    while (!isAfter(c, endDate)) {
      list.push(format(c, "yyyy-MM"));
      c = addMonths(c, 1);
    }
    return list;
  }, [startDate, endDate]);
  const monthsCount = Math.max(1, horizonMonths.length);
  const stressPerMonth = stressExtraOutflow / monthsCount;

  const budgetLines = (budgetLinesQuery.data ?? []) as BudgetLine[];

  // DP realized costs by month — only entries actually paid/realized.
  // Virtual DP projections (source="dp" + status="previsto") are excluded so
  // they don't double-count between Realizado and Projetado.
  const dpByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of materializedEntries) {
      if (e.source === "dp" && e.tipo === "saida" && e.valor_realizado != null) {
        const key = e.data_prevista.slice(0, 7);
        map[key] = (map[key] ?? 0) + Number(e.valor_realizado);
      }
    }
    return map;
  }, [materializedEntries]);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // ===== Realizado =====
  // Only count entries that were actually realized (have valor_realizado set
  // OR explicit realized statuses). Virtual DP/contract projections that may
  // be present in the merged stream are filtered out by the source check.
  const realizedByMonth = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number }> = {};
    for (const e of materializedEntries) {
      const isRealized =
        e.valor_realizado != null ||
        e.status === "pago" ||
        e.status === "recebido" ||
        e.status === "conciliado";
      if (!isRealized) continue;
      const key = e.data_prevista.slice(0, 7);
      if (!map[key]) map[key] = { entradas: 0, saidas: 0 };
      const val = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") map[key].entradas += val;
      else map[key].saidas += val;
    }
    return map;
  }, [materializedEntries]);

  // ===== Orçado =====
  const budgetedByMonth = useMemo(() => {
    const map: Record<string, { receita: number; gasto: number }> = {};
    for (const line of budgetLines) {
      const key = line.month.slice(0, 7);
      if (!map[key]) map[key] = { receita: 0, gasto: 0 };
      if (line.tipo === "receita") {
        map[key].receita += Number(line.valor_orcado);
      } else {
        map[key].gasto += Number(line.valor_orcado);
      }
    }
    return map;
  }, [budgetLines]);

  // ===== Projetado (forward-looking, mesma granularidade mensal) =====
  // Componentes (sem dupla contagem):
  //   1. Contratos: usa generateProjectionsFromContract — respeita data_inicio/data_fim,
  //      intervalo de recorrência (mensal/bi/tri/sem/anual) e dia_vencimento.
  //      Contratos não-recorrentes (mercadoria, serviços pontuais) são tratados via
  //      installments / lançamento único e NÃO entram aqui para evitar duplicar com Realizado.
  //   2. DP/Folha: soma payrollProjections por mês (eles já vêm com data_prevista correta).
  //   3. CRM: aplica pipeline ponderado no mês de estimated_close_date; oportunidades
  //      sem data são distribuídas igualmente nos meses do horizonte.
  const projectedByMonth = useMemo(() => {
    const map: Record<string, { receita: number; gasto: number }> = {};
    for (const key of horizonMonths) map[key] = { receita: 0, gasto: 0 };

    // 1. Contracts — per-month, respecting active window
    for (const c of contracts) {
      const projs = generateProjectionsFromContract(c, startDate, endDate);
      for (const p of projs) {
        const key = p.data_prevista.slice(0, 7);
        if (!map[key]) continue;
        const v = Number(p.valor_previsto);
        if (p.tipo === "entrada") map[key].receita += v;
        else map[key].gasto += v;
      }
    }

    // 2. DP / Folha — already month-stamped (data_prevista = first day of month)
    for (const p of payrollProjections) {
      const key = String(p.data_prevista).slice(0, 7);
      if (!map[key]) continue;
      map[key].gasto += Number(p.valor_previsto);
    }

    // 3. CRM weighted pipeline — concentrate on estimated_close_date when known
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
        if (map[key]) {
          map[key].receita += weighted;
        } else {
          // Fora do horizonte → ignora (não inflar projeção)
        }
      } else {
        undatedWeighted += weighted;
      }
    }
    if (undatedWeighted > 0) {
      const perMonth = undatedWeighted / monthsCount;
      for (const key of horizonMonths) map[key].receita += perMonth;
    }

    return map;
  }, [contracts, payrollProjections, opportunities, stages, horizonMonths, monthsCount, startDate, endDate]);

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
        "Cenário (Receita)": budgeted.receita * receitaFactor,
        "Cenário (Gasto)": -(budgeted.gasto * custoFactor + stressPerMonth),
        "Projetado (Receita)": projected.receita,
        "Projetado (Gasto)": -projected.gasto,
      });
      cursor = addMonths(cursor, 1);
    }
    return data;
  }, [realizedByMonth, budgetedByMonth, projectedByMonth, startDate, endDate, receitaFactor, custoFactor, stressPerMonth]);

  // Variance table by month
  const varianceData = useMemo(() => {
    return chartData.map((d) => {
      const realizado = d["Realizado (Entrada)"] + d["Realizado (Saída)"];
      const orcado = d["Orçado (Receita)"] + d["Orçado (Gasto)"];
      const cenario = d["Cenário (Receita)"] + d["Cenário (Gasto)"];
      const projetado = d["Projetado (Receita)"] + d["Projetado (Gasto)"];
      const dp = dpByMonth[d.monthKey] ?? 0;
      const variacao = orcado !== 0 ? ((realizado - orcado) / Math.abs(orcado)) * 100 : 0;
      const variacaoCenario = orcado !== 0 ? ((cenario - orcado) / Math.abs(orcado)) * 100 : 0;
      return {
        mes: d.mes,
        orcado,
        cenario,
        realizado,
        projetado,
        dp,
        diferenca: realizado - orcado,
        variacao,
        variacaoCenario,
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
        <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Orçado × Cenário × Realizado × Projetado</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Cenário aplica variações de receita/custo e impacto de passivos sob stress.
              Projetado combina contratos recorrentes, folha (DP) e pipeline ponderado do CRM.
            </p>
          </div>
          {!isBaseScenario && activeScenario && (
            <Badge variant="outline" className="gap-1.5 text-xs h-fit">
              <Sparkles className="h-3 w-3 text-primary" />
              Sob {activeScenario.name}
            </Badge>
          )}
        </div>
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
            {!isBaseScenario && (
              <Bar dataKey="Cenário (Receita)" fill="hsl(var(--primary) / 0.85)" radius={[4, 4, 0, 0]} />
            )}
            <Bar dataKey="Projetado (Receita)" fill="hsl(var(--success) / 0.5)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Realizado (Entrada)" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Orçado (Gasto)" fill="hsl(var(--warning) / 0.4)" radius={[0, 0, 4, 4]} />
            {!isBaseScenario && (
              <Bar dataKey="Cenário (Gasto)" fill="hsl(var(--warning) / 0.85)" radius={[0, 0, 4, 4]} />
            )}
            <Bar dataKey="Projetado (Gasto)" fill="hsl(var(--destructive) / 0.5)" radius={[0, 0, 4, 4]} />
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
              {!isBaseScenario && (
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Sob Cenário
                  </div>
                </TableHead>
              )}
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
                {!isBaseScenario && (
                  <TableCell className={cn(
                    "text-right font-medium",
                    row.cenario >= row.orcado ? "text-success" : "text-destructive"
                  )}>
                    {fmt(row.cenario)}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({row.variacaoCenario >= 0 ? "+" : ""}{row.variacaoCenario.toFixed(1)}%)
                    </span>
                  </TableCell>
                )}
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
