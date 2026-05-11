import { useMemo } from "react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Legend, ReferenceLine,
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
  /** When provided, charts overlay Previsto x Realizado series. */
  realizadoEntries?: CashFlowEntry[];
  previstoEntries?: CashFlowEntry[];
}

const isTransfer = (e: CashFlowEntry) => (e.categoria ?? "") === "transferencia_interna";
const isProvisao = (e: CashFlowEntry) => (e as any).dp_sub_category === "provisao_acumulada";

const todayKey = format(new Date(), "dd/MM");

export function FluxoCaixaCharts({ entries, realizadoEntries, previstoEntries }: Props) {
  const overlay = !!(realizadoEntries && previstoEntries);

  // ---- Single-series mode (Realizado / Projetado tab) -----------------------
  const singleData = useMemo(() => {
    if (overlay) return [];
    const byDay: Record<string, { dia: string; entradas: number; saidas: number; saldo: number }> = {};
    let runningBalance = 0;
    for (const e of entries) {
      if (isTransfer(e) || isProvisao(e)) continue;
      const dia = format(new Date(e.data_prevista), "dd/MM");
      if (!byDay[dia]) byDay[dia] = { dia, entradas: 0, saidas: 0, saldo: 0 };
      const sign = e.is_estorno ? -1 : 1;
      const val = sign * Number(e.valor_realizado ?? e.valor_previsto);
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
  }, [entries, overlay]);

  // ---- Overlay mode (Visão Geral) -------------------------------------------
  const overlayData = useMemo(() => {
    if (!overlay) return [];
    const byDay: Record<string, {
      dia: string;
      entradas_real: number;
      saidas_real: number;
      entradas_prev: number;
      saidas_prev: number;
      saldo_real: number;
      saldo_proj: number;
    }> = {};

    const ensure = (dia: string) => {
      if (!byDay[dia]) byDay[dia] = {
        dia, entradas_real: 0, saidas_real: 0, entradas_prev: 0, saidas_prev: 0,
        saldo_real: 0, saldo_proj: 0,
      };
      return byDay[dia];
    };

    for (const e of realizadoEntries!) {
      if (isTransfer(e) || isProvisao(e)) continue;
      const dia = format(new Date(e.data_realizada ?? e.data_prevista), "dd/MM");
      const sign = e.is_estorno ? -1 : 1;
      const val = sign * Number(e.valor_realizado ?? e.valor_previsto);
      const row = ensure(dia);
      if (e.tipo === "entrada") row.entradas_real += val;
      else row.saidas_real += val;
    }
    for (const e of previstoEntries!) {
      if (isTransfer(e) || isProvisao(e)) continue;
      const dia = format(new Date(e.data_prevista), "dd/MM");
      const sign = e.is_estorno ? -1 : 1;
      const val = sign * Number(e.valor_previsto);
      const row = ensure(dia);
      if (e.tipo === "entrada") row.entradas_prev += val;
      else row.saidas_prev += val;
    }

    const sorted = Object.values(byDay).sort((a, b) => a.dia.localeCompare(b.dia));
    let real = 0;
    let proj = 0;
    for (const r of sorted) {
      real += r.entradas_real - r.saidas_real;
      proj += (r.entradas_real + r.entradas_prev) - (r.saidas_real + r.saidas_prev);
      r.saldo_real = real;
      r.saldo_proj = proj;
    }
    return sorted;
  }, [overlay, realizadoEntries, previstoEntries]);

  const chartData = overlay ? overlayData : singleData;
  if (chartData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {overlay ? "Entradas vs Saídas — Realizado vs Previsto" : "Entradas vs Saídas"}
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {overlay ? (
              <>
                <Bar dataKey="entradas_real" name="Entradas (real)" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="entradas_prev" name="Entradas (prev.)" fill="hsl(var(--success))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas_real" name="Saídas (real)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas_prev" name="Saídas (prev.)" fill="hsl(var(--destructive))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
              </>
            ) : (
              <>
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {overlay ? "Evolução do Saldo — Realizado vs Projetado" : "Evolução do Saldo"}
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1.5} />
            {chartData.some((d: any) => d.dia === todayKey) && (
              <ReferenceLine x={todayKey} stroke="hsl(var(--primary))" strokeDasharray="2 4" label={{ value: "Hoje", fill: "hsl(var(--primary))", fontSize: 10 }} />
            )}
            {overlay ? (
              <>
                <Line type="monotone" dataKey="saldo_real" name="Saldo Realizado" stroke="hsl(var(--success))" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="saldo_proj" name="Saldo Projetado" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="saldo"
                name="Saldo"
                stroke={chartData.some((d: any) => d.saldo < 0) ? "hsl(var(--destructive))" : "hsl(var(--success))"}
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
