// Trilha de melhoria sugerida automaticamente a partir do checklist de maturidade.
// Ordena os itens incompletos por (pontos faltantes ÷ esforço), agrupa em marcos
// (Configurar → Atualizar → Operar) e indica quanto falta para subir de faixa.

import {
  ChecklistItem,
  MaturityCategory,
  MaturityLabel,
  SectorMaturityResult,
} from "./types";

export type EffortLevel = "baixo" | "medio" | "alto";

const EFFORT_BY_KEY: Record<string, EffortLevel> = {
  "dp-config-tributaria": "baixo",
  "dp-business-days": "baixo",
  "dp-positions": "baixo",
  "dp-positions-detail": "medio",
  "dp-employees": "medio",
  "dp-employees-link": "medio",
  "dp-benefits": "baixo",
  "dp-employee-benefits": "medio",
  "dp-documents": "alto",
  "dp-payroll-prev": "baixo",
  "dp-raises-12m": "medio",
  "dp-vacations-planned": "medio",
  "dp-docs-fresh": "medio",
  "dp-routines": "alto",
};

const EFFORT_WEIGHT: Record<EffortLevel, number> = {
  baixo: 1,
  medio: 2,
  alto: 3,
};

export const EFFORT_META: Record<EffortLevel, { label: string; badgeClass: string }> = {
  baixo: { label: "Esforço baixo", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  medio: { label: "Esforço médio", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  alto: { label: "Esforço alto", badgeClass: "bg-destructive/10 text-destructive border-destructive/30" },
};

export interface ImprovementStep {
  key: string;
  label: string;
  category: MaturityCategory;
  effort: EffortLevel;
  potentialPoints: number;        // pts faltantes (weight - earned)
  ratio: number;                  // potentialPoints / EFFORT_WEIGHT
  hint?: string;
  detail?: string;
  ctaTab?: string;
  source: ChecklistItem;
}

export interface ImprovementMilestone {
  category: MaturityCategory;
  label: string;
  potentialPoints: number;
  steps: ImprovementStep[];
}

export interface ImprovementTrack {
  totalPotential: number;
  pointsToNextLabel: number | null;
  nextLabel: MaturityLabel | null;
  milestones: ImprovementMilestone[];
  topSteps: ImprovementStep[];   // top 5 priorizados
}

const NEXT_LABEL_THRESHOLD: Record<MaturityLabel, { next: MaturityLabel | null; threshold: number | null }> = {
  critico: { next: "desenvolvimento", threshold: 40 },
  desenvolvimento: { next: "maduro", threshold: 70 },
  maduro: { next: "excelente", threshold: 90 },
  excelente: { next: null, threshold: null },
};

const CATEGORY_LABEL: Record<MaturityCategory, string> = {
  completude: "1. Configurar a estrutura",
  atualizacao: "2. Manter informações atualizadas",
  rotinas: "3. Operar com disciplina (rotinas)",
};

export function buildImprovementTrack(result: SectorMaturityResult): ImprovementTrack {
  const incomplete = result.checklist.filter((i) => i.earned < i.weight);

  const steps: ImprovementStep[] = incomplete.map((item) => {
    const effort = EFFORT_BY_KEY[item.key] ?? "medio";
    const potentialPoints = Math.max(0, item.weight - item.earned);
    const ratio = potentialPoints / EFFORT_WEIGHT[effort];
    return {
      key: item.key,
      label: item.label,
      category: item.category,
      effort,
      potentialPoints,
      ratio,
      hint: item.hint,
      detail: item.detail,
      ctaTab: item.ctaTab,
      source: item,
    };
  });

  // Ordena globalmente por melhor relação ganho/esforço
  const sorted = [...steps].sort((a, b) => b.ratio - a.ratio);

  const milestones: ImprovementMilestone[] = (
    ["completude", "atualizacao", "rotinas"] as MaturityCategory[]
  ).map((cat) => {
    const catSteps = sorted.filter((s) => s.category === cat);
    return {
      category: cat,
      label: CATEGORY_LABEL[cat],
      potentialPoints: Math.round(catSteps.reduce((s, x) => s + x.potentialPoints, 0) * 10) / 10,
      steps: catSteps,
    };
  });

  const totalPotential = Math.round(steps.reduce((s, x) => s + x.potentialPoints, 0) * 10) / 10;

  const nextMeta = NEXT_LABEL_THRESHOLD[result.label];
  const pointsToNextLabel =
    nextMeta.threshold !== null ? Math.max(0, nextMeta.threshold - result.score) : null;

  return {
    totalPotential,
    pointsToNextLabel,
    nextLabel: nextMeta.next,
    milestones,
    topSteps: sorted.slice(0, 5),
  };
}
