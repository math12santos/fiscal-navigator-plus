/**
 * ============================================================================
 * Projection Registry — Source of Truth for virtual cashflow entries
 * ----------------------------------------------------------------------------
 * Centralizes the canonical deduplication keys ("source_ref") used to match
 * a virtual projection against its materialized counterpart in
 * `cashflow_entries`.
 *
 * Five MECE sources:
 *   1. contrato            -> contrato:<id>:<yyyy-MM-dd>
 *   2. contrato_parcela    -> parcela:<installment_id>
 *                             (fallback contrato:<id>:<vencimento>)
 *   3. dp                  -> dp:<employee_id>:<sub_category>:<yyyy-MM>
 *   4. crm_won             -> crm:<opportunity_id>
 *   5. hr_planning         -> hr:<item_id>
 *
 * The same string is what the SQL `dedup_hash` is computed on
 * (md5(organization_id|source|source_ref)) — guaranteeing both directions:
 *   - UI: hides projections already materialized
 *   - DB: rejects duplicate inserts via UNIQUE INDEX
 * ============================================================================
 */

import type { CashFlowEntry } from "@/hooks/useCashFlow";

export type ProjectionSource =
  | "contrato"
  | "contrato_parcela"
  | "dp"
  | "dp_rescisao"
  | "crm_won"
  | "hr_planning";

/** Canonical keys used everywhere for matching projections vs materialized. */
export const projectionKey = {
  contract(contractId: string, dataPrevista: string): string {
    return `contrato:${contractId}:${dataPrevista.slice(0, 10)}`;
  },
  installment(installmentId: string | null | undefined, contractId?: string | null, dataVencimento?: string | null): string {
    if (installmentId) return `parcela:${installmentId}`;
    if (contractId && dataVencimento) return `contrato:${contractId}:${dataVencimento.slice(0, 10)}`;
    return "";
  },
  payroll(employeeId: string, subCategory: string, monthKey: string): string {
    return `dp:${employeeId}:${subCategory}:${monthKey.slice(0, 7)}`;
  },
  /** Eventos variáveis de folha (proventos/descontos pontuais). */
  payrollEvent(eventId: string): string {
    return `dp_event:${eventId}`;
  },
  crmWon(opportunityId: string): string {
    return `crm:${opportunityId}`;
  },
  hrPlanning(itemId: string): string {
    return `hr:${itemId}`;
  },
  /** Rescisão materializada como compromisso de caixa único (não-recorrente). */
  termination(terminationId: string): string {
    return `rescisao:${terminationId}`;
  },
};

/**
 * Extract source_ref from a materialized cashflow entry, falling back to
 * legacy `notes` markers for rows that haven't been backfilled yet.
 * Mirrors the SQL backfill logic.
 */
export function extractSourceRef(entry: Partial<CashFlowEntry> & { source_ref?: string | null }): string | null {
  if (entry.source_ref) return entry.source_ref;
  const notes = entry.notes ?? "";
  const source = entry.source ?? "";

  if (source === "crm_won") {
    const m = notes.match(/opp:([0-9a-fA-F-]{36})/);
    if (m) return projectionKey.crmWon(m[1]);
  }
  if (source === "hr_planning") {
    const m = notes.match(/Item:\s*([0-9a-fA-F-]{36})/);
    if (m) return projectionKey.hrPlanning(m[1]);
  }
  if (source === "contrato") {
    if (entry.contract_installment_id) {
      return projectionKey.installment(entry.contract_installment_id);
    }
    if (entry.contract_id && entry.data_prevista) {
      return projectionKey.contract(entry.contract_id, entry.data_prevista);
    }
  }
  return null;
}

/**
 * Build a Set of source_refs already materialized in the DB so projection
 * builders can skip them.  Accepts both new `source_ref` column and legacy
 * markers in `notes`.
 */
export function buildMaterializedRefs(
  materialized: Array<Partial<CashFlowEntry> & { source_ref?: string | null }>
): Set<string> {
  const refs = new Set<string>();
  for (const e of materialized) {
    const ref = extractSourceRef(e);
    if (ref) refs.add(ref);
  }
  return refs;
}

/**
 * Filter a list of virtual projections to drop the ones already materialized.
 * Each virtual projection MUST carry a `source_ref` field for this to work.
 */
export function dedupAgainstMaterialized<T extends { source_ref?: string }>(
  virtual: T[],
  materialized: Array<Partial<CashFlowEntry> & { source_ref?: string | null }>
): T[] {
  const refs = buildMaterializedRefs(materialized);
  return virtual.filter((v) => !v.source_ref || !refs.has(v.source_ref));
}
