import { useMemo } from "react";
import { format, addMonths, startOfMonth, endOfMonth, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useContracts } from "@/hooks/useContracts";
import { usePlanningConfig } from "@/hooks/usePlanningConfig";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";
import { KPICard } from "@/components/KPICard";
import { AlertTriangle, TrendingUp, Wallet, Shield, Users } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function PlanningOverview({ startDate, endDate }: Props) {
  const { entries, totals } = useCashFlow(startDate, endDate);
  const { contracts } = useContracts();
  const { config } = usePlanningConfig();
  const { accounts } = useChartOfAccounts();
  const { avgMonthlyPayroll } = usePayrollProjections(startDate, endDate);

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

    return Object.entries(months).map(([key, val]) => ({
      mes: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
      entradas: val.entradas,
      saidas: val.saidas,
      saldo: val.entradas - val.saidas,
    }));
  }, [entries, startDate, endDate]);

  // Runway calculation
  const avgMonthlySaida = useMemo(() => {
    const total = monthlyData.reduce((s, m) => s + m.saidas, 0);
    return monthlyData.length > 0 ? total / monthlyData.length : 0;
  }, [monthlyData]);

  const saldoAtual = totals.saldo;
  const runway = avgMonthlySaida > 0 ? Math.floor(saldoAtual / avgMonthlySaida) : Infinity;
  const saldoMinimo = config?.saldo_minimo ?? 0;
  const alertaRunway = config?.runway_alerta_meses ?? 3;

  // Active contracts count
  const activeContracts = contracts.filter((c) => c.status === "Ativo").length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Receita Projetada"
          value={fmt(totals.entradas)}
          icon={<TrendingUp size={20} />}
        />
        <KPICard
          title="Despesa Projetada"
          value={fmt(totals.saidas)}
          icon={<Wallet size={20} />}
        />
        <KPICard
          title="Custo Folha/mês"
          value={fmt(avgMonthlyPayroll)}
          icon={<Users size={20} />}
        />
        <KPICard
          title="Saldo Projetado"
          value={fmt(totals.saldo)}
          icon={<Shield size={20} />}
        />
        <div className="glass-card p-5 animate-slide-up">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Runway</p>
              <p className={`text-2xl font-bold ${runway <= alertaRunway ? "text-destructive" : "text-success"}`}>
                {runway === Infinity ? "∞" : `${runway} meses`}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeContracts} contratos ativos
              </p>
            </div>
            {runway <= alertaRunway && runway !== Infinity && (
              <div className="rounded-lg bg-destructive/10 p-2.5 text-destructive">
                <AlertTriangle size={20} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saldo Mínimo Alert */}
      {saldoMinimo > 0 && saldoAtual < saldoMinimo && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-destructive">Projeção abaixo do saldo mínimo</p>
            <p className="text-muted-foreground">
              Saldo projetado {fmt(saldoAtual)} está abaixo do mínimo configurado de {fmt(saldoMinimo)}.
            </p>
          </div>
        </div>
      )}

      {/* Monthly Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Projeção Mensal — Entradas vs Saídas</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyData}>
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
              <ReferenceLine y={saldoMinimo} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: "Saldo Mín.", fill: "hsl(var(--destructive))", fontSize: 10 }} />
            )}
            <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
