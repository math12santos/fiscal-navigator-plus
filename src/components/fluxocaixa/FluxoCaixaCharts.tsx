import { useMemo } from "react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts";
import type { CashFlowEntry } from "@/hooks/useCashFlow";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

interface Props {
  entries: CashFlowEntry[];
}

export function FluxoCaixaCharts({ entries }: Props) {
  const chartData = useMemo(() => {
    const byDay: Record<string, { dia: string; entradas: number; saidas: number; saldo: number }> = {};
    let runningBalance = 0;
    for (const e of entries) {
      const dia = format(new Date(e.data_prevista), "dd/MM");
      if (!byDay[dia]) byDay[dia] = { dia, entradas: 0, saidas: 0, saldo: 0 };
      const val = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") {
        byDay[dia].entradas += val;
        runningBalance += val;
      } else {
        byDay[dia].saidas += val;
        runningBalance -= val;
      }
      byDay[dia].saldo = runningBalance;
    }
    return Object.values(byDay).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [entries]);

  if (chartData.length === 0) return null;

  const hasNegative = chartData.some((d) => d.saldo < 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Entradas vs Saídas</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Evolução do Saldo</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="saldoGradPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="saldoGradNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1.5} />
            <Area
              type="monotone"
              dataKey="saldo"
              name="Saldo"
              stroke={hasNegative ? "hsl(var(--destructive))" : "hsl(var(--success))"}
              fill={hasNegative ? "url(#saldoGradNegative)" : "url(#saldoGradPositive)"}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
