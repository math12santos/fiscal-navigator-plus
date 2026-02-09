import { PageHeader } from "@/components/PageHeader";
import { cashFlowData } from "@/data/mockData";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-medium text-foreground">Dia {label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

export default function FluxoCaixa() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Fluxo de Caixa" description="Gestão do fluxo de caixa realizado e previsto" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Entradas</p>
          <p className="text-xl font-bold text-success mt-1">R$ 2.290.000</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Saídas</p>
          <p className="text-xl font-bold text-destructive mt-1">R$ 1.700.000</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saldo Final</p>
          <p className="text-xl font-bold text-primary mt-1">R$ 4.606.890</p>
        </div>
      </div>

      {/* Cash flow chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Entradas vs Saídas</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
            <XAxis dataKey="dia" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="entradas" name="Entradas" fill="hsl(152, 60%, 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balance evolution */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Evolução do Saldo</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={cashFlowData}>
            <defs>
              <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
            <XAxis dataKey="dia" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(174, 72%, 50%)" fill="url(#saldoGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
