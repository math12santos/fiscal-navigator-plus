/**
 * Cálculo puro da exposição jurídica.
 * Sem React, sem I/O — testável diretamente.
 */
import type { JuridicoProcess, ProcessProbability } from "./types";

const PROB_WEIGHT: Record<ProcessProbability, number> = {
  remota: 0.1,
  possivel: 0.5,
  provavel: 0.9,
};

export interface RiskExposure {
  totalExposure: number;
  weightedExposure: number;
  byProbability: Record<ProcessProbability, { count: number; total: number }>;
}

export function computeRiskExposure(
  processes: Pick<JuridicoProcess, "status" | "probabilidade" | "valor_causa">[]
): RiskExposure {
  const active = processes.filter((p) => p.status === "ativo");
  const byProbability: RiskExposure["byProbability"] = {
    remota: { count: 0, total: 0 },
    possivel: { count: 0, total: 0 },
    provavel: { count: 0, total: 0 },
  };
  let totalExposure = 0;
  let weightedExposure = 0;
  for (const p of active) {
    const v = Number(p.valor_causa ?? 0);
    totalExposure += v;
    weightedExposure += v * PROB_WEIGHT[p.probabilidade];
    byProbability[p.probabilidade].count += 1;
    byProbability[p.probabilidade].total += v;
  }
  return { totalExposure, weightedExposure, byProbability };
}
