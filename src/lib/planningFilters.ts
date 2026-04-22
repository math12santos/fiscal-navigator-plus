/**
 * Filtros operacionais aplicados às visões de Planejamento (Cockpit,
 * Plan×Real×Projetado e exportação PDF). Esta é a *única* fonte de verdade —
 * Planejamento.tsx mantém o estado, todos os consumidores recebem por prop e
 * aplicam de forma idêntica para garantir números consistentes entre tela e PDF.
 *
 * Modelo: a Unidade (subsidiária) é single-select porque pertence ao contexto
 * de holding e não admite mistura. Conta bancária e centro de custo são
 * multi-select — array vazio significa "todas/todos" (sem filtro).
 */
export interface PlanningFilters {
  /** Subsidiária específica em modo holding. `null` = todas as orgs ativas. */
  subsidiaryOrgId: string | null;
  /** Contas bancárias selecionadas. `[]` = todas. */
  bankAccountIds: string[];
  /** Centros de custo selecionados. `[]` = todos. Aplica a entries, contratos e folha. */
  costCenterIds: string[];
}

export const EMPTY_PLANNING_FILTERS: PlanningFilters = {
  subsidiaryOrgId: null,
  bankAccountIds: [],
  costCenterIds: [],
};

export function hasAnyFilter(f: PlanningFilters): boolean {
  return !!(f.subsidiaryOrgId || f.bankAccountIds.length > 0 || f.costCenterIds.length > 0);
}

/**
 * Normaliza filtros vindos de fontes externas (URL, histórico antigo salvo
 * antes da multi-seleção). Aceita campos legados `bankAccountId`/`costCenterId`
 * como string única e converte para array. Garante sempre um objeto válido.
 */
export function normalizeFilters(input: any): PlanningFilters {
  if (!input || typeof input !== "object") return { ...EMPTY_PLANNING_FILTERS };

  const toArray = (v: any): string[] => {
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.length > 0);
    if (typeof v === "string" && v.length > 0) return [v];
    return [];
  };

  return {
    subsidiaryOrgId:
      typeof input.subsidiaryOrgId === "string" && input.subsidiaryOrgId.length > 0
        ? input.subsidiaryOrgId
        : null,
    bankAccountIds: toArray(input.bankAccountIds ?? input.bankAccountId),
    costCenterIds: toArray(input.costCenterIds ?? input.costCenterId),
  };
}

/** Filtra um lançamento (cashflow_entry) segundo as dimensões ativas. */
export function entryMatchesFilters<
  T extends {
    organization_id?: string | null;
    conta_bancaria_id?: string | null;
    cost_center_id?: string | null;
  },
>(entry: T, f: PlanningFilters): boolean {
  if (f.subsidiaryOrgId && entry.organization_id !== f.subsidiaryOrgId) return false;
  if (
    f.bankAccountIds.length > 0 &&
    (!entry.conta_bancaria_id || !f.bankAccountIds.includes(entry.conta_bancaria_id))
  ) {
    return false;
  }
  if (
    f.costCenterIds.length > 0 &&
    (!entry.cost_center_id || !f.costCenterIds.includes(entry.cost_center_id))
  ) {
    return false;
  }
  return true;
}

/** Para contratos / folha onde só faz sentido o centro de custo + organização. */
export function contractMatchesFilters<
  T extends { organization_id?: string | null; cost_center_id?: string | null },
>(entity: T, f: PlanningFilters): boolean {
  if (f.subsidiaryOrgId && entity.organization_id !== f.subsidiaryOrgId) return false;
  if (
    f.costCenterIds.length > 0 &&
    (!entity.cost_center_id || !f.costCenterIds.includes(entity.cost_center_id))
  ) {
    return false;
  }
  return true;
}

/**
 * Único divisor de meses do horizonte. Retorna chaves `yyyy-MM` cobrindo
 * todos os meses entre `start` e `end` (inclusive). Use `.length` como
 * divisor para médias mensais (burn, folha/mês, stress) — garante que
 * Cockpit, Plan×Real×Projetado e PDF compartilhem a mesma contagem.
 */
export function getHorizonMonths(start: Date, end: Date): string[] {
  const list: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor.getTime() <= last.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    list.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return list;
}
