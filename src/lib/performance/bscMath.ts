// Cálculos puros do BSC (replicam a regra do trigger Postgres).

export type BscIndicatorStatus = "abaixo" | "parcial" | "atingido" | "superado";

export interface IndicatorInput {
  meta: number;
  realizado: number;
  peso?: number;
  quanto_menor_melhor?: boolean;
}

export interface IndicatorComputed {
  percentual_atingimento: number;
  nota_ponderada: number;
  status: BscIndicatorStatus;
}

export function computeIndicator(i: IndicatorInput): IndicatorComputed {
  const peso = i.peso ?? 1;
  let pct = 0;
  if (i.meta === 0) {
    pct = 0;
  } else if (i.quanto_menor_melhor) {
    pct = i.realizado === 0 ? 0 : (i.meta / i.realizado) * 100;
  } else {
    pct = (i.realizado / i.meta) * 100;
  }
  pct = Math.round(pct * 100) / 100;
  const status: BscIndicatorStatus =
    pct < 70 ? "abaixo" :
    pct < 90 ? "parcial" :
    pct <= 100 ? "atingido" : "superado";
  return {
    percentual_atingimento: pct,
    nota_ponderada: Math.round(pct * peso * 100) / 100,
    status,
  };
}

export function computeBscTotal(indicators: IndicatorInput[]): number {
  let totalPeso = 0;
  let totalPond = 0;
  for (const i of indicators) {
    const peso = i.peso ?? 1;
    const c = computeIndicator(i);
    totalPeso += peso;
    totalPond += c.nota_ponderada;
  }
  if (totalPeso === 0) return 0;
  return Math.round((totalPond / totalPeso) * 100) / 100;
}

export const BSC_PERSPECTIVA_LABEL: Record<string, string> = {
  financeira: "Financeira",
  clientes: "Clientes",
  processos: "Processos Internos",
  aprendizado: "Aprendizado",
};

export const BSC_STATUS_META: Record<BscIndicatorStatus, { label: string; class: string }> = {
  abaixo:    { label: "Abaixo da meta", class: "bg-destructive/10 text-destructive border-destructive/30" },
  parcial:   { label: "Parcial",        class: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  atingido:  { label: "Atingido",       class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  superado:  { label: "Superado",       class: "bg-primary/10 text-primary border-primary/30" },
};
