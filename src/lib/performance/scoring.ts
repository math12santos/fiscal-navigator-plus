// Lógica pura para a Matriz 9 Box criteriosa.
// - Score ponderado por critério
// - Triangulação por fonte (gestor / auto / par)
// - Confiabilidade da avaliação
// - Detecção de viés do gestor (inflação/deflação)

import type { NineBoxLevel } from "./quadrante";
import { quadrantFrom } from "./quadrante";

export type SourceKind = "gestor" | "auto" | "par";
export type Dimension = "desempenho" | "potencial";

export interface CriterionRow {
  id: string;
  dimension: Dimension;
  name: string;
  weight: number;
  anchor_1?: string | null;
  anchor_2?: string | null;
  anchor_3?: string | null;
  anchor_4?: string | null;
  anchor_5?: string | null;
}

export interface ScoreRow {
  criterion_id: string;
  source: SourceKind;
  score: number; // 1..5
  evidence_text?: string | null;
  evidence_url?: string | null;
}

export interface SourceRow {
  source: SourceKind;
  weight: number;     // peso da fonte
  submitted: boolean; // se essa fonte realmente avaliou
}

export const DEFAULT_SOURCE_WEIGHTS: Record<SourceKind, number> = {
  gestor: 60,
  auto: 20,
  par: 20,
};

/** Média ponderada das notas de uma única fonte para uma dimensão. */
export function weightedScoreForSource(
  criteria: CriterionRow[],
  scores: ScoreRow[],
  dimension: Dimension,
  source: SourceKind,
): number | null {
  const dimCrit = criteria.filter((c) => c.dimension === dimension);
  if (dimCrit.length === 0) return null;

  let sumW = 0;
  let sumWS = 0;
  for (const c of dimCrit) {
    const s = scores.find((x) => x.criterion_id === c.id && x.source === source);
    if (!s) continue;
    sumW += Number(c.weight);
    sumWS += Number(c.weight) * Number(s.score);
  }
  if (sumW === 0) return null;
  return Math.round((sumWS / sumW) * 10) / 10;
}

/** Triangula entre fontes que enviaram (peso ponderado). */
export function triangulate(
  criteria: CriterionRow[],
  scores: ScoreRow[],
  sources: SourceRow[],
  dimension: Dimension,
): number | null {
  let sumW = 0;
  let sumWS = 0;
  for (const src of sources) {
    if (!src.submitted) continue;
    const s = weightedScoreForSource(criteria, scores, dimension, src.source);
    if (s == null) continue;
    sumW += Number(src.weight);
    sumWS += Number(src.weight) * s;
  }
  if (sumW === 0) return null;
  return Math.round((sumWS / sumW) * 10) / 10;
}

/** 0..100. Considera fontes presentes e cobertura de evidências em notas extremas. */
export function confidenceScore(
  criteria: CriterionRow[],
  scores: ScoreRow[],
  sources: SourceRow[],
): number {
  const submitted = sources.filter((s) => s.submitted);
  if (submitted.length === 0) return 0;

  // Componente 1 — diversidade de fontes (0..60)
  const diversity = Math.min(60, submitted.length * 20);

  // Componente 2 — cobertura: % de critérios da rubrica avaliados pelo gestor (0..30)
  const gestorScores = scores.filter((s) => s.source === "gestor");
  const coverage =
    criteria.length === 0 ? 0 : Math.min(30, Math.round((gestorScores.length / criteria.length) * 30));

  // Componente 3 — evidências em notas extremas (0..10)
  const extreme = scores.filter((s) => s.score <= 2 || s.score >= 4);
  const withEv = extreme.filter(
    (s) => (s.evidence_text && s.evidence_text.trim()) || (s.evidence_url && s.evidence_url.trim()),
  );
  const evidenceRatio = extreme.length === 0 ? 1 : withEv.length / extreme.length;
  const evidenceScore = Math.round(evidenceRatio * 10);

  return Math.min(100, diversity + coverage + evidenceScore);
}

export interface BiasReport {
  total: number;
  perQuadrant: Record<number, number>;
  perQuadrantPct: Record<number, number>;
  topPct: number;        // % em Q8+Q9
  bottomPct: number;     // % em Q1+Q2
  unilateralPct: number; // % com só 1 fonte
  inflationAlert: boolean;
  deflationAlert: boolean;
  unilateralAlert: boolean;
  notes: string[];
}

export interface TeamEvaluationSummary {
  quadrante: number | null;
  sourcesSubmittedCount: number;
}

/** Limites: >60% no topo (Q8/Q9) ou >50% no fundo (Q1/Q2) ou >70% unilateral. */
export function detectBias(team: TeamEvaluationSummary[]): BiasReport {
  const total = team.length;
  const per: Record<number, number> = {};
  for (let q = 1; q <= 9; q++) per[q] = 0;
  let unilateral = 0;
  for (const ev of team) {
    if (ev.quadrante && per[ev.quadrante] != null) per[ev.quadrante] += 1;
    if (ev.sourcesSubmittedCount <= 1) unilateral += 1;
  }
  const pct: Record<number, number> = {};
  for (let q = 1; q <= 9; q++) pct[q] = total ? Math.round((per[q] / total) * 100) : 0;
  const topPct = pct[8] + pct[9];
  const bottomPct = pct[1] + pct[2];
  const unilateralPct = total ? Math.round((unilateral / total) * 100) : 0;

  const notes: string[] = [];
  const inflationAlert = topPct > 60;
  const deflationAlert = bottomPct > 50;
  const unilateralAlert = unilateralPct > 70;
  if (inflationAlert) notes.push(`Inflação: ${topPct}% do time em Q8/Q9 (limite 60%).`);
  if (deflationAlert) notes.push(`Deflação: ${bottomPct}% em Q1/Q2 (limite 50%).`);
  if (unilateralAlert) notes.push(`${unilateralPct}% das avaliações têm apenas 1 fonte.`);

  return {
    total,
    perQuadrant: per,
    perQuadrantPct: pct,
    topPct,
    bottomPct,
    unilateralPct,
    inflationAlert,
    deflationAlert,
    unilateralAlert,
    notes,
  };
}

/** Atalho usado pelo wizard de revisão. */
export function computeFinalQuadrant(
  criteria: CriterionRow[],
  scores: ScoreRow[],
  sources: SourceRow[],
): { notaDes: number | null; notaPot: number | null; quadrante: number | null } {
  const notaDes = triangulate(criteria, scores, sources, "desempenho");
  const notaPot = triangulate(criteria, scores, sources, "potencial");
  const quadrante = notaDes != null && notaPot != null ? quadrantFrom(notaDes, notaPot) : null;
  return { notaDes, notaPot, quadrante };
}

export function levelLabel(level: NineBoxLevel | null): string {
  if (!level) return "—";
  return level === "baixo" ? "Baixo" : level === "medio" ? "Médio" : "Alto";
}
