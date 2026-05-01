import { ShieldAlert } from "lucide-react";
import { useJuridicoProcesses } from "@/hooks/useJuridico";
import { useMemo } from "react";
import { SectionCard } from "@/components/SectionCard";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

const probs = ["remota", "possivel", "provavel"] as const;
const ranges = [
  { key: "baixo", label: "Baixo (< 10k)", min: 0, max: 10_000 },
  { key: "medio", label: "Médio (10k - 100k)", min: 10_000, max: 100_000 },
  { key: "alto", label: "Alto (100k - 1M)", min: 100_000, max: 1_000_000 },
  { key: "critico", label: "Crítico (> 1M)", min: 1_000_000, max: Infinity },
];

export function JuridicoRiskMatrix() {
  const { list } = useJuridicoProcesses();
  const data = list.data ?? [];

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, { count: number; total: number }>> = {};
    for (const r of ranges) {
      m[r.key] = {};
      for (const p of probs) m[r.key][p] = { count: 0, total: 0 };
    }
    for (const proc of data) {
      const v = Number(proc.valor_estimado_perda || 0);
      const r = ranges.find((x) => v >= x.min && v < x.max);
      if (!r) continue;
      const p = proc.probabilidade as string;
      if (!m[r.key][p]) continue;
      m[r.key][p].count += 1;
      m[r.key][p].total += Number(proc.valor_provisionado || 0);
    }
    return m;
  }, [data]);

  const cellColor = (prob: string, range: string) => {
    const high = (prob === "provavel" && (range === "alto" || range === "critico")) || (prob === "possivel" && range === "critico");
    const med = prob === "provavel" || (prob === "possivel" && range === "alto") || (prob === "remota" && range === "critico");
    if (high) return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    if (med) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
  };

  return (
    <div className="space-y-4">
      <SectionCard
        icon={ShieldAlert}
        title="Matriz de Risco"
        description="Probabilidade × Impacto. Cada célula mostra a quantidade de processos e o total provisionado."
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2 text-sm">Impacto ↓ / Probabilidade →</th>
                {probs.map((p) => (
                  <th key={p} className="p-2 text-sm capitalize text-center">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranges.slice().reverse().map((r) => (
                <tr key={r.key}>
                  <td className="p-2 text-sm font-medium">{r.label}</td>
                  {probs.map((p) => {
                    const cell = matrix[r.key][p];
                    return (
                      <td key={p} className="p-1">
                        <div className={`border rounded-md p-3 text-center ${cellColor(p, r.key)}`}>
                          <div className="text-2xl font-bold">{cell.count}</div>
                          <div className="text-xs">{fmt(cell.total)}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          A cor da célula reflete a prioridade de atenção (verde = baixo, âmbar = médio, vermelho = alto).
        </p>
      </SectionCard>
    </div>
  );
}
