// Tipos compartilhados do termômetro de maturidade setorial.
// Cada setor (DP, Financeiro, CRM, ...) define seus próprios checks
// e a forma de avaliação, mas todos retornam um SectorMaturityResult.

export type SectorKey = "dp" | "financeiro" | "crm" | "contratos" | "planejamento";

export type MaturityCategory = "completude" | "atualizacao" | "rotinas";

export type MaturityLabel = "critico" | "desenvolvimento" | "maduro" | "excelente";

export interface ChecklistItem {
  key: string;
  label: string;
  category: MaturityCategory;
  weight: number;          // pontos máximos do item
  earned: number;          // pontos obtidos (0..weight)
  done?: boolean;          // shortcut para UI (earned >= weight) — preenchido pelo avaliador
  hint?: string;           // descrição/dica de ação
  ctaTab?: string;         // aba do módulo para onde levar o usuário
  detail?: string;         // métrica resumida ("3 de 5", "vencido há 12 dias", ...)
}

export interface SectorMaturityResult {
  score: number;                 // 0..100 (soma das 3 dimensões)
  completeness: number;          // 0..50
  freshness: number;             // 0..25
  routines: number;              // 0..25
  label: MaturityLabel;
  checklist: ChecklistItem[];
}

export function maturityLabelFromScore(score: number): MaturityLabel {
  if (score >= 90) return "excelente";
  if (score >= 70) return "maduro";
  if (score >= 40) return "desenvolvimento";
  return "critico";
}

export const MATURITY_LABEL_META: Record<MaturityLabel, { label: string; color: string; badgeClass: string }> = {
  critico: {
    label: "Crítico",
    color: "hsl(var(--destructive))",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
  },
  desenvolvimento: {
    label: "Em desenvolvimento",
    color: "hsl(38 92% 50%)",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  maduro: {
    label: "Maduro",
    color: "hsl(217 91% 60%)",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  excelente: {
    label: "Excelente",
    color: "hsl(142 71% 45%)",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
};

export const SECTOR_META: Record<SectorKey, { label: string; route: string }> = {
  dp: { label: "Departamento Pessoal", route: "/dp" },
  financeiro: { label: "Financeiro", route: "/financeiro" },
  crm: { label: "CRM Comercial", route: "/crm" },
  contratos: { label: "Contratos", route: "/contratos" },
  planejamento: { label: "Planejamento", route: "/planejamento" },
};
