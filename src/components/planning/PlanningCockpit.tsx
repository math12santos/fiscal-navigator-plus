import { useMemo } from "react";
import { format, addMonths, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useContracts } from "@/hooks/useContracts";
import { usePlanningConfig } from "@/hooks/usePlanningConfig";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";
import { useLiabilities } from "@/hooks/useLiabilities";
import { useFinancialSummary } from "@/hooks/useFinancialSummary";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, TrendingUp, Wallet, Shield, Users, FileSignature,
  TrendingDown, Target, ArrowRight, Info,
} from "lucide-react";
import type { PlanningTab } from "@/hooks/useFinancialSummary";

/** Custom event fired by alert action buttons to switch the active planning tab. */
export const PLANNING_NAV_EVENT = "planning:navigate";
export function emitPlanningNav(tab: PlanningTab) {
  window.dispatchEvent(new CustomEvent(PLANNING_NAV_EVENT, { detail: { tab } }));
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function PlanningCockpit({ startDate, endDate }: Props) {
  const { entries, totals } = useCashFlow(startDate, endDate);
  const { contracts } = useContracts();
  const { config } = usePlanningConfig();
  const { avgMonthlyPayroll } = usePayrollProjections(startDate, endDate);
  const { totals: liabTotals } = useLiabilities();
  const { crmWeightedValue, alerts } = useFinancialSummary(startDate, endDate);

  // Monthly aggregation
  const monthlyData = useMemo(() => {
    const months: Record<string, { entradas: number; saidas: number }> = {};
    let cursor = startOfMonth(startDate);
    while (!isAfter(cursor, endDate)) {
      const key = format(cursor, "yyyy-MM");
      months[key] = { entradas: 0, saidas: 0 };
      cursor = addMonths(cursor, 1);
    }

    for (const e of entries) {
      const key = e.data_prevista.slice(0, 7);
      if (months[key]) {
        const val = Number(e.valor_realizado ?? e.valor_previsto);
        if (e.tipo === "entrada") months[key].entradas += val;
        else months[key].saidas += val;
      }
    }

    let acc = 0;
    return Object.entries(months).map(([key, val]) => {
      const saldoMes = val.entradas - val.saidas;
      acc += saldoMes;
      return {
        mes: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
        entradas: val.entradas,
        saidas: val.saidas,
        saldoAcumulado: Math.round(acc),
      };
    });
  }, [entries, startDate, endDate]);

  // Burn / Runway
  const avgMonthlySaida = useMemo(() => {
    const total = monthlyData.reduce((s, m) => s + m.saidas, 0);
    return monthlyData.length > 0 ? total / monthlyData.length : 0;
  }, [monthlyData]);

  const saldoAtual = totals.saldo;
  const runway = avgMonthlySaida > 0 ? Math.floor(saldoAtual / avgMonthlySaida) : Infinity;
  const saldoMinimo = config?.saldo_minimo ?? 0;
  const alertaRunway = config?.runway_alerta_meses ?? 3;

  const activeContracts = contracts.filter((c) => c.status === "Ativo").length;
  const runwayCritical = runway !== Infinity && runway <= alertaRunway;

  return (
    <div className="space-y-6">
      {/* Primary KPIs — CFO-first row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Saldo Projetado"
          value={fmt(saldoAtual)}
          icon={<Shield size={20} />}
        />
        <div className="glass-card p-5 animate-slide-up">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Runway</p>
              <p className={`text-2xl font-bold ${runwayCritical ? "text-destructive" : "text-success"}`}>
                {runway === Infinity ? "∞" : `${runway} meses`}
              </p>
              <p className="text-xs text-muted-foreground">
                Alerta: &lt; {alertaRunway} meses
              </p>
            </div>
            {runwayCritical && (
              <div className="rounded-lg bg-destructive/10 p-2.5 text-destructive">
                <AlertTriangle size={20} />
              </div>
            )}
          </div>
        </div>
        <KPICard
          title="Burn Mensal Médio"
          value={fmt(avgMonthlySaida)}
          icon={<TrendingDown size={20} />}
        />
        <KPICard
          title="Receita × Despesa"
          value={`${fmt(totals.entradas)} / ${fmt(totals.saidas)}`}
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* Secondary mini KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          title="Custo Folha/mês"
          value={fmt(avgMonthlyPayroll)}
          icon={<Users size={18} />}
        />
        <KPICard
          title="Contratos Ativos"
          value={String(activeContracts)}
          icon={<FileSignature size={18} />}
        />
        <KPICard
          title="Passivos Total"
          value={fmt(liabTotals.total)}
          icon={<AlertTriangle size={18} />}
        />
        <KPICard
          title="Pipeline Ponderado"
          value={fmt(crmWeightedValue)}
          icon={<Target size={18} />}
        />
      </div>

      {/*
        Alertas estratégicos unificados.
        Saldo mínimo, runway, passivos, contratos, divergências e CRM
        agora compartilham o mesmo componente, idioma e ação sugerida.
      */}
      {alerts.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Alertas Estratégicos ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, idx) => {
              const tone =
                alert.type === "danger"
                  ? { wrap: "bg-destructive/5 border-destructive/20", icon: "text-destructive" }
                  : alert.type === "warning"
                  ? { wrap: "bg-warning/5 border-warning/20", icon: "text-warning" }
                  : { wrap: "bg-muted/30 border-border", icon: "text-muted-foreground" };
              const Icon = alert.type === "info" ? Info : AlertTriangle;
              return (
                <div
                  key={`${alert.category}-${idx}`}
                  className={`flex flex-wrap items-start gap-3 p-3 rounded-lg border ${tone.wrap}`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone.icon}`} />
                  <div className="text-sm flex-1 min-w-[200px]">
                    <p className="font-medium text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => emitPlanningNav(alert.actionTab)}
                  >
                    {alert.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unified Chart: bars + accumulated balance line */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Projeção Mensal — Entradas, Saídas e Saldo Acumulado
        </h3>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: number) => fmt(v)}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {saldoMinimo > 0 && (
              <ReferenceLine
                y={saldoMinimo}
                stroke="hsl(var(--destructive))"
                strokeDasharray="5 5"
                label={{ value: "Saldo Mín.", fill: "hsl(var(--destructive))", fontSize: 10 }}
              />
            )}
            <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="saldoAcumulado"
              name="Saldo Acumulado"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
