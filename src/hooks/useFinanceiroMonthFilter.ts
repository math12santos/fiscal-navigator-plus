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

/** Recalcula os totais MECE (mesma fórmula de useFinanceiro) para uma lista filtrada. */
export function computeFinanceiroTotals(entries: FinanceiroEntry[]) {
  let total_previsto = 0;
  let total_realizado = 0;
  let em_pagamento = 0;
  let count_em_pagamento = 0;
  let pendente = 0;
  let count_pendente = 0;

  for (const e of entries) {
    if ((e as any).dp_sub_category === "provisao_acumulada") continue;
    if ((e as any).categoria === "transferencia_interna") continue;
    if ((e as any).is_estorno) {
      const v = Number(e.valor_realizado ?? e.valor_previsto);
      total_previsto -= v;
      total_realizado -= v;
      continue;
    }
    const isRealized = e.status === "pago" || e.status === "recebido";
    const isIssued = e.status === "pagamento_emitido" || e.status === "recebimento_esperado";
    const isPending = e.status === "previsto" || e.status === "confirmado";
    const valorRef = isRealized
      ? Number(e.valor_realizado ?? e.valor_previsto)
      : Number(e.valor_previsto);
    total_previsto += valorRef;
    if (isRealized) {
      total_realizado += Number(e.valor_realizado ?? e.valor_previsto);
    } else if (isIssued) {
      em_pagamento += Number(e.valor_previsto);
      count_em_pagamento++;
    } else if (isPending) {
      pendente += Number(e.valor_previsto);
      count_pendente++;
    }
  }

  return {
    total_previsto,
    total_realizado,
    em_pagamento,
    count_em_pagamento,
    pendente,
    count_pendente,
    total: entries.length,
  };
}
