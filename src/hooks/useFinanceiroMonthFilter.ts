import { useMemo } from "react";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";
import { useFinanceiroMonth } from "@/contexts/FinanceiroMonthContext";

/** Returns the yyyy-MM bucket for an entry, preferring realized date when present. */
export function entryMonth(e: FinanceiroEntry): string | null {
  const d =
    (e as any).data_realizada ||
    (e as any).data_prevista ||
    (e as any).data_vencimento ||
    null;
  if (!d || typeof d !== "string") return null;
  return d.slice(0, 7);
}

/** Filters a list of FinanceiroEntry by the working month from FinanceiroMonthContext. */
export function useFinanceiroMonthFilter<T extends FinanceiroEntry>(entries: T[]): T[] {
  const { workingMonth } = useFinanceiroMonth();
  return useMemo(() => {
    if (!workingMonth) return entries;
    return entries.filter((e) => entryMonth(e) === workingMonth);
  }, [entries, workingMonth]);
}
