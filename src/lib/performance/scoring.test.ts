// Testes da lógica de scoring 9 Box.
import { describe, it, expect } from "vitest";
import {
  weightedScoreForSource,
  triangulate,
  confidenceScore,
  detectBias,
  computeFinalQuadrant,
  type CriterionRow,
  type ScoreRow,
  type SourceRow,
} from "./scoring";

const criteria: CriterionRow[] = [
  { id: "d1", dimension: "desempenho", name: "Entrega", weight: 40 },
  { id: "d2", dimension: "desempenho", name: "Qualidade", weight: 20 },
  { id: "d3", dimension: "desempenho", name: "Prazos", weight: 15 },
  { id: "d4", dimension: "desempenho", name: "Colab", weight: 15 },
  { id: "d5", dimension: "desempenho", name: "Valores", weight: 10 },
  { id: "p1", dimension: "potencial", name: "Aprend", weight: 25 },
  { id: "p2", dimension: "potencial", name: "Lid", weight: 25 },
  { id: "p3", dimension: "potencial", name: "Adapt", weight: 20 },
  { id: "p4", dimension: "potencial", name: "Visão", weight: 20 },
  { id: "p5", dimension: "potencial", name: "Mob", weight: 10 },
];

const fullEv = "ev";

describe("scoring 9 Box", () => {
  it("weightedScoreForSource calcula média ponderada por dimensão", () => {
    const scores: ScoreRow[] = criteria
      .filter((c) => c.dimension === "desempenho")
      .map((c) => ({ criterion_id: c.id, source: "gestor", score: 5, evidence_text: fullEv }));
    expect(weightedScoreForSource(criteria, scores, "desempenho", "gestor")).toBe(5);
  });

  it("triangulate combina fontes pelos pesos", () => {
    const scores: ScoreRow[] = [
      ...criteria
        .filter((c) => c.dimension === "desempenho")
        .map<ScoreRow>((c) => ({ criterion_id: c.id, source: "gestor", score: 4, evidence_text: fullEv })),
      ...criteria
        .filter((c) => c.dimension === "desempenho")
        .map<ScoreRow>((c) => ({ criterion_id: c.id, source: "auto", score: 5, evidence_text: fullEv })),
    ];
    const sources: SourceRow[] = [
      { source: "gestor", weight: 60, submitted: true },
      { source: "auto", weight: 20, submitted: true },
      { source: "par", weight: 20, submitted: false },
    ];
    const out = triangulate(criteria, scores, sources, "desempenho");
    // (4*60 + 5*20)/80 = 4.25
    expect(out).toBe(4.3);
  });

  it("confidenceScore aumenta com mais fontes e cobertura", () => {
    const scores: ScoreRow[] = criteria.map((c) => ({
      criterion_id: c.id,
      source: "gestor",
      score: 3,
    }));
    const onlyGestor: SourceRow[] = [
      { source: "gestor", weight: 60, submitted: true },
      { source: "auto", weight: 20, submitted: false },
      { source: "par", weight: 20, submitted: false },
    ];
    const allThree: SourceRow[] = [
      { source: "gestor", weight: 60, submitted: true },
      { source: "auto", weight: 20, submitted: true },
      { source: "par", weight: 20, submitted: true },
    ];
    expect(confidenceScore(criteria, scores, onlyGestor)).toBeLessThan(
      confidenceScore(criteria, scores, allThree),
    );
  });

  it("detectBias sinaliza inflação", () => {
    const team = Array.from({ length: 10 }, () => ({ quadrante: 9, sourcesSubmittedCount: 2 }));
    const r = detectBias(team);
    expect(r.inflationAlert).toBe(true);
    expect(r.topPct).toBe(100);
  });

  it("detectBias sinaliza unilateralidade", () => {
    const team = Array.from({ length: 5 }, () => ({ quadrante: 5, sourcesSubmittedCount: 1 }));
    const r = detectBias(team);
    expect(r.unilateralAlert).toBe(true);
  });

  it("computeFinalQuadrant entrega quadrante a partir das notas", () => {
    const scores: ScoreRow[] = criteria.map((c) => ({
      criterion_id: c.id,
      source: "gestor",
      score: 5,
      evidence_text: fullEv,
    }));
    const sources: SourceRow[] = [{ source: "gestor", weight: 60, submitted: true }];
    const r = computeFinalQuadrant(criteria, scores, sources);
    expect(r.quadrante).toBe(9);
  });
});
