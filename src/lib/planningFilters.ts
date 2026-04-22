/**
 * Filtros operacionais aplicados às visões de Planejamento (Cockpit,
 * Plan×Real×Projetado e exportação PDF). Esta é a *única* fonte de verdade —
 * Planejamento.tsx mantém o estado, todos os consumidores recebem por prop e
 * aplicam de forma idêntica para garantir números consistentes entre tela e PDF.
 *
 * Cada chave `null` significa "sem filtro nesta dimensão" (todos).
 */
export interface PlanningFilters {
  /** Subsidiária específica em modo holding. `null` = todas as orgs ativas. */
  subsidiaryOrgId: string | null;
  /** Conta bancária. `null` = todas. */
  bankAccountId: string | null;
  /** Centro de custo. `null` = todos. Aplica a entries, contratos e folha. */
  costCenterId: string | null;
}

export const EMPTY_PLANNING_FILTERS: PlanningFilters = {
  subsidiaryOrgId: null,
  bankAccountId: null,
  costCenterId: null,
};

export function hasAnyFilter(f: PlanningFilters): boolean {
  return !!(f.subsidiaryOrgId || f.bankAccountId || f.costCenterId);
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
  if (f.bankAccountId && entry.conta_bancaria_id !== f.bankAccountId) return false;
  if (f.costCenterId && entry.cost_center_id !== f.costCenterId) return false;
  return true;
}

/** Para contratos / folha onde só faz sentido o centro de custo + organização. */
export function contractMatchesFilters<
  T extends { organization_id?: string | null; cost_center_id?: string | null },
>(entity: T, f: PlanningFilters): boolean {
  if (f.subsidiaryOrgId && entity.organization_id !== f.subsidiaryOrgId) return false;
  if (f.costCenterId && entity.cost_center_id !== f.costCenterId) return false;
  return true;
}
