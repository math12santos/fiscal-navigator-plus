import { PageHeader } from "@/components/PageHeader";
import { scenarioData } from "@/data/mockData";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const merged = scenarioData.realista.map((r, i) => ({
  mes: r.mes,
  otimista: scenarioData.otimista[i].valor,
  realista: r.valor,
  conservador: scenarioData.conservador[i].valor,
}));

export default function Planejamento() {
  const [active, setActive] = useState<"otimista" | "realista" | "conservador">("realista");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Planejamento Financeiro" description="Análise de cenários e apoio à decisão estratégica" />

      {/* Scenario selector */}
      <div className="flex gap-2">
        {(["otimista", "realista", "conservador"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActive(s)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all",
              active === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Receita Projetada (6m)</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {fmt(scenarioData[active].reduce((a, b) => a + b.valor, 0))}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Média Mensal</p>
          <p className="text-xl font-bold text-primary mt-1">
            {fmt(scenarioData[active].reduce((a, b) => a + b.valor, 0) / 6)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Crescimento Esperado</p>
          <p className={cn(
            "text-xl font-bold mt-1",
            active === "otimista" ? "text-success" : active === "conservador" ? "text-warning" : "text-primary"
          )}>
            {active === "otimista" ? "+35.9%" : active === "conservador" ? "+4.0%" : "+12.4%"}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Comparação de Cenários</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
            <XAxis dataKey="mes" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(222, 44%, 8%)", border: "1px solid hsl(222, 30%, 16%)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="otimista" name="Otimista" stroke="hsl(152, 60%, 45%)" strokeWidth={active === "otimista" ? 3 : 1} strokeDasharray={active === "otimista" ? "0" : "5 5"} dot={false} />
            <Line type="monotone" dataKey="realista" name="Realista" stroke="hsl(174, 72%, 50%)" strokeWidth={active === "realista" ? 3 : 1} strokeDasharray={active === "realista" ? "0" : "5 5"} dot={false} />
            <Line type="monotone" dataKey="conservador" name="Conservador" stroke="hsl(38, 92%, 55%)" strokeWidth={active === "conservador" ? 3 : 1} strokeDasharray={active === "conservador" ? "0" : "5 5"} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
