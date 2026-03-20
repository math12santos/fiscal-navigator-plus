import { useMemo } from "react";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";

export type DuplicateCategory =
  | "exact"
  | "similar_value"
  | "no_entity"
  | "projection_vs_manual"
  | "import_vs_existing";

export type DuplicateSeverity = "high" | "medium";

export interface DuplicatePair {
  a: FinanceiroEntry;
  b: FinanceiroEntry;
  reason: string;
  category: DuplicateCategory;
  severity: DuplicateSeverity;
}

const CATEGORY_LABELS: Record<DuplicateCategory, string> = {
  exact: "Duplicidade exata",
  similar_value: "Valor similar",
  no_entity: "Descrição similar",
  projection_vs_manual: "Projeção vs Manual",
  import_vs_existing: "Importação vs Existente",
};

export { CATEGORY_LABELS };

// ─── Text similarity ──────────────────────────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  ta.forEach((t) => { if (tb.has(t)) intersection++; });
  return intersection / Math.max(ta.size, tb.size);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function daysDiff(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

function valueDiffPct(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
}

function isProjection(e: FinanceiroEntry): boolean {
  return e.id.startsWith("proj-");
}

function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/**
 * MECE duplicate detection across 5 categories:
 * 1. Exact: same entity + identical value + same date
 * 2. Similar value: same entity + value ±5% + date ±7d
 * 3. No entity: description similarity ≥80% + value ±5% + date ±7d
 * 4. Projection vs Manual: manual entry duplicates a projection in same month
 * 5. Import vs Existing: imported entry matches existing (value ±2% + date ±3d + desc similarity)
 */
export function useDuplicateDetection(entries: FinanceiroEntry[]) {
  return useMemo(() => {
    const duplicates: DuplicatePair[] = [];
    const seen = new Set<string>();

    const key = (a: string, b: string) => [a, b].sort().join("|");

    const real = entries.filter((e) => !isProjection(e));
    const projections = entries.filter((e) => isProjection(e));

    // Active (non-paid) real entries for categories 1-3
    const active = real.filter(
      (e) => e.status === "previsto" || e.status === "confirmado" || e.status === "pendente"
    );

    // ── Category 1 & 2: Same entity ──
    const withEntity = active.filter((e) => e.entity_id);
    for (let i = 0; i < withEntity.length; i++) {
      for (let j = i + 1; j < withEntity.length; j++) {
        const a = withEntity[i];
        const b = withEntity[j];
        if (a.entity_id !== b.entity_id) continue;

        const va = Number(a.valor_previsto);
        const vb = Number(b.valor_previsto);
        if (va === 0 || vb === 0) continue;

        const diff = valueDiffPct(va, vb);
        const dd = daysDiff(a.data_prevista, b.data_prevista);
        const k = key(a.id, b.id);

        if (diff === 0 && dd === 0 && !seen.has(k)) {
          seen.add(k);
          duplicates.push({
            a, b,
            reason: `Mesmo fornecedor, valor idêntico (${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(va)}), mesma data`,
            category: "exact",
            severity: "high",
          });
        } else if (diff <= 0.05 && dd <= 7 && !seen.has(k)) {
          seen.add(k);
          duplicates.push({
            a, b,
            reason: `Mesmo fornecedor, valor ${diff < 0.01 ? "idêntico" : "±" + Math.round(diff * 100) + "%"}, datas ${Math.round(dd)}d`,
            category: "similar_value",
            severity: "medium",
          });
        }
      }
    }

    // ── Category 3: No entity, description similarity ──
    const noEntity = active.filter((e) => !e.entity_id && e.descricao);
    for (let i = 0; i < noEntity.length; i++) {
      for (let j = i + 1; j < noEntity.length; j++) {
        const a = noEntity[i];
        const b = noEntity[j];
        const k = key(a.id, b.id);
        if (seen.has(k)) continue;

        const sim = tokenSimilarity(a.descricao, b.descricao);
        if (sim < 0.8) continue;

        const diff = valueDiffPct(Number(a.valor_previsto), Number(b.valor_previsto));
        if (diff > 0.05) continue;

        const dd = daysDiff(a.data_prevista, b.data_prevista);
        if (dd > 7) continue;

        seen.add(k);
        duplicates.push({
          a, b,
          reason: `Descrição ${Math.round(sim * 100)}% similar, valor ±${Math.round(diff * 100)}%, datas ${Math.round(dd)}d`,
          category: "no_entity",
          severity: "medium",
        });
      }
    }

    // ── Category 4: Projection vs Manual ──
    for (const proj of projections) {
      for (const manual of real) {
        if (manual.source === "importacao") continue; // handled in cat 5
        const k = key(proj.id, manual.id);
        if (seen.has(k)) continue;

        if (!sameMonth(proj.data_prevista, manual.data_prevista)) continue;

        const sameEntity = proj.entity_id && proj.entity_id === manual.entity_id;
        const descSim = tokenSimilarity(proj.descricao, manual.descricao) >= 0.6;
        if (!sameEntity && !descSim) continue;

        const diff = valueDiffPct(Number(proj.valor_previsto), Number(manual.valor_previsto));
        if (diff > 0.1) continue;

        seen.add(k);
        duplicates.push({
          a: proj, b: manual,
          reason: `Lançamento manual pode duplicar projeção (${sameEntity ? "mesmo fornecedor" : "descrição similar"}, valor ±${Math.round(diff * 100)}%)`,
          category: "projection_vs_manual",
          severity: "high",
        });
      }
    }

    // ── Category 5: Import vs Existing ──
    const imported = real.filter((e) => e.source === "importacao");
    const existing = real.filter((e) => e.source !== "importacao");
    for (const imp of imported) {
      for (const ex of existing) {
        const k = key(imp.id, ex.id);
        if (seen.has(k)) continue;

        const diff = valueDiffPct(Number(imp.valor_previsto), Number(ex.valor_previsto));
        if (diff > 0.02) continue;

        const dd = daysDiff(imp.data_prevista, ex.data_prevista);
        if (dd > 3) continue;

        const descSim = tokenSimilarity(imp.descricao, ex.descricao);
        const sameEntity = imp.entity_id && imp.entity_id === ex.entity_id;
        if (descSim < 0.6 && !sameEntity) continue;

        seen.add(k);
        duplicates.push({
          a: imp, b: ex,
          reason: `Importação pode duplicar existente (valor ±${Math.round(diff * 100)}%, datas ${Math.round(dd)}d${sameEntity ? ", mesmo fornecedor" : ""})`,
          category: "import_vs_existing",
          severity: "high",
        });
      }
    }

    return duplicates;
  }, [entries]);
}

/**
 * Check imported rows (pre-import) against existing entries for duplicates.
 */
export function detectImportDuplicates(
  importedRows: { descricao?: string; valor_previsto?: number; data_prevista?: string }[],
  existingEntries: FinanceiroEntry[]
): Set<number> {
  const duplicateIndices = new Set<number>();
  const active = existingEntries.filter((e) => !e.id.startsWith("proj-"));

  for (let i = 0; i < importedRows.length; i++) {
    const row = importedRows[i];
    if (!row.valor_previsto || !row.data_prevista) continue;

    for (const ex of active) {
      const diff = valueDiffPct(row.valor_previsto, Number(ex.valor_previsto));
      if (diff > 0.02) continue;

      const dd = daysDiff(row.data_prevista, ex.data_prevista);
      if (dd > 3) continue;

      const descSim = row.descricao ? tokenSimilarity(row.descricao, ex.descricao) : 0;
      if (descSim < 0.5) continue;

      duplicateIndices.add(i);
      break;
    }
  }

  return duplicateIndices;
}
