// Metas de maturidade configuráveis por organização e setor.
// Defaults usados quando a organização ainda não criou um registro em
// `sector_maturity_targets`.

import { SectorKey } from "./types";

export interface SectorMaturityTargets {
  routines_target_pct: number;          // 0..1 — meta de cumprimento de rotinas
  routines_overdue_tolerance_pct: number; // 0..1 — fração tolerada de atrasados
  reconciliation_target_pct: number;    // 0..1 — meta de conciliação (Fin)
  classification_target_pct: number;    // 0..1 — meta de lançamentos classificados (Fin)
  bank_freshness_days: number;          // dias para saldo "fresco" (Fin)
  overdue_critical_days: number;        // dias para vencido crítico (Fin)
  overdue_max_count: number;            // qtd que zera a nota de vencidos (Fin)
  documents_required: string[];         // docs obrigatórios (DP)
  payroll_close_required: boolean;      // exige folha mês anterior fechada (DP)
  period_close_required: boolean;       // exige período fiscal anterior fechado (Fin)
  // Jurídico
  movement_freshness_days: number;      // dias máx. sem movimento em processo ativo (Jur)
  provision_required_for_provavel: boolean; // exige provisão para perda provável (Jur)
  // TI
  sla_target_pct: number;               // meta de chamados dentro do SLA (TI)
  renewal_alert_days: number;           // dias para alertar renovação (TI)
  warranty_alert_days: number;          // dias para alertar garantia vencendo (TI)
}

export const DEFAULT_TARGETS: SectorMaturityTargets = {
  routines_target_pct: 0.85,
  routines_overdue_tolerance_pct: 0.10,
  reconciliation_target_pct: 0.90,
  classification_target_pct: 0.95,
  bank_freshness_days: 7,
  overdue_critical_days: 30,
  overdue_max_count: 10,
  documents_required: ["contrato", "rg", "cpf"],
  payroll_close_required: true,
  period_close_required: true,
  movement_freshness_days: 90,
  provision_required_for_provavel: true,
  sla_target_pct: 0.90,
  renewal_alert_days: 90,
  warranty_alert_days: 60,
};

export function normalizeTargets(row: Partial<SectorMaturityTargets> | null | undefined): SectorMaturityTargets {
  if (!row) return { ...DEFAULT_TARGETS };
  return {
    routines_target_pct: clamp01(row.routines_target_pct, DEFAULT_TARGETS.routines_target_pct),
    routines_overdue_tolerance_pct: clamp01(row.routines_overdue_tolerance_pct, DEFAULT_TARGETS.routines_overdue_tolerance_pct),
    reconciliation_target_pct: clamp01(row.reconciliation_target_pct, DEFAULT_TARGETS.reconciliation_target_pct),
    classification_target_pct: clamp01(row.classification_target_pct, DEFAULT_TARGETS.classification_target_pct),
    bank_freshness_days: posInt(row.bank_freshness_days, DEFAULT_TARGETS.bank_freshness_days, 90),
    overdue_critical_days: posInt(row.overdue_critical_days, DEFAULT_TARGETS.overdue_critical_days, 365),
    overdue_max_count: posInt(row.overdue_max_count, DEFAULT_TARGETS.overdue_max_count, 1000),
    documents_required: Array.isArray(row.documents_required) && row.documents_required.length
      ? row.documents_required.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : DEFAULT_TARGETS.documents_required,
    payroll_close_required: row.payroll_close_required ?? DEFAULT_TARGETS.payroll_close_required,
    period_close_required: row.period_close_required ?? DEFAULT_TARGETS.period_close_required,
    movement_freshness_days: posInt(row.movement_freshness_days, DEFAULT_TARGETS.movement_freshness_days, 365),
    provision_required_for_provavel: row.provision_required_for_provavel ?? DEFAULT_TARGETS.provision_required_for_provavel,
    sla_target_pct: clamp01(row.sla_target_pct, DEFAULT_TARGETS.sla_target_pct),
    renewal_alert_days: posInt(row.renewal_alert_days, DEFAULT_TARGETS.renewal_alert_days, 365),
    warranty_alert_days: posInt(row.warranty_alert_days, DEFAULT_TARGETS.warranty_alert_days, 365),
  };
}

export function fieldsForSector(sector: SectorKey): (keyof SectorMaturityTargets)[] {
  if (sector === "dp") {
    return [
      "routines_target_pct",
      "routines_overdue_tolerance_pct",
      "documents_required",
      "payroll_close_required",
    ];
  }
  if (sector === "juridico") {
    return [
      "routines_target_pct",
      "routines_overdue_tolerance_pct",
      "movement_freshness_days",
      "provision_required_for_provavel",
    ];
  }
  if (sector === "ti") {
    return [
      "routines_target_pct",
      "routines_overdue_tolerance_pct",
      "sla_target_pct",
      "renewal_alert_days",
      "warranty_alert_days",
    ];
  }
  // financeiro
  return [
    "routines_target_pct",
    "routines_overdue_tolerance_pct",
    "reconciliation_target_pct",
    "classification_target_pct",
    "bank_freshness_days",
    "overdue_critical_days",
    "overdue_max_count",
    "period_close_required",
  ];
}

function clamp01(v: any, def: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(0, Math.min(1, n));
}
function posInt(v: any, def: number, max: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(max, n);
}
