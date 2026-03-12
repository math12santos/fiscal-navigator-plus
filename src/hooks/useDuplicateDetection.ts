import { useMemo } from "react";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";

export interface DuplicatePair {
  a: FinanceiroEntry;
  b: FinanceiroEntry;
  reason: string;
}

/**
 * Detects potential duplicate entries based on:
 * - Same entity_id (supplier)
 * - Similar value (±5%)
 * - Close dates (±7 days)
 */
export function useDuplicateDetection(entries: FinanceiroEntry[]) {
  return useMemo(() => {
    const duplicates: DuplicatePair[] = [];
    // Only check real (non-projected) pending entries
    const candidates = entries.filter(
      (e) => !e.id.startsWith("proj-") && e.entity_id && (e.status === "previsto" || e.status === "confirmado")
    );

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];

        if (a.entity_id !== b.entity_id) continue;

        const va = Number(a.valor_previsto);
        const vb = Number(b.valor_previsto);
        if (va === 0 || vb === 0) continue;
        const diff = Math.abs(va - vb) / Math.max(va, vb);
        if (diff > 0.05) continue;

        const da = new Date(a.data_prevista).getTime();
        const db = new Date(b.data_prevista).getTime();
        const daysDiff = Math.abs(da - db) / (1000 * 60 * 60 * 24);
        if (daysDiff > 7) continue;

        duplicates.push({
          a,
          b,
          reason: `Mesmo fornecedor, valor similar (${diff < 0.01 ? "idêntico" : "±" + Math.round(diff * 100) + "%"}), datas próximas (${Math.round(daysDiff)}d)`,
        });
      }
    }

    return duplicates;
  }, [entries]);
}
