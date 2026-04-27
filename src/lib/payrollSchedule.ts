/**
 * Payroll disbursement schedule helpers.
 *
 * Translates "competency month" (mês de referência da folha) into the actual
 * **payment date** that will hit the bank account, based on `dp_config`
 * calendar fields. CFO-first: the cash flow must reflect when money leaves
 * the bank, not when the obligation accrues.
 */
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  addDays,
  getDay,
  setDate,
  format,
  lastDayOfMonth,
} from "date-fns";

export type PaymentBasis = "business_day" | "calendar_day";

export interface DPScheduleConfig {
  advance_enabled?: boolean;
  advance_pct?: number;
  advance_payment_day?: number;
  salary_payment_day?: number;
  salary_payment_basis?: PaymentBasis | string;
  inss_due_day?: number;
  fgts_due_day?: number;
  irrf_due_day?: number;
  /** -1 = último dia útil do mês anterior */
  benefits_payment_day?: number;
  health_payment_day?: number;
}

const DEFAULTS: Required<Omit<DPScheduleConfig, "salary_payment_basis">> & {
  salary_payment_basis: PaymentBasis;
} = {
  advance_enabled: false,
  advance_pct: 40,
  advance_payment_day: 20,
  salary_payment_day: 5,
  salary_payment_basis: "business_day",
  inss_due_day: 20,
  fgts_due_day: 20,
  irrf_due_day: 20,
  benefits_payment_day: -1,
  health_payment_day: 10,
};

function isBusinessDay(d: Date): boolean {
  const w = getDay(d);
  return w >= 1 && w <= 5;
}

/** N-ésimo dia útil de um mês (n = 1..N). Se n excede, retorna o último dia útil. */
export function nthBusinessDay(monthAnchor: Date, n: number): Date {
  let cursor = startOfMonth(monthAnchor);
  let count = 0;
  let last = cursor;
  const end = endOfMonth(monthAnchor);
  while (cursor <= end) {
    if (isBusinessDay(cursor)) {
      count += 1;
      last = new Date(cursor);
      if (count === n) return last;
    }
    cursor = addDays(cursor, 1);
  }
  return last;
}

/** Último dia útil do mês de referência. */
export function lastBusinessDayOf(monthAnchor: Date): Date {
  let cursor = lastDayOfMonth(monthAnchor);
  while (!isBusinessDay(cursor)) cursor = addDays(cursor, -1);
  return cursor;
}

/**
 * Aplica `dia` calendário a `monthAnchor`, com clamp se exceder o último dia
 * (ex.: dia 31 em fevereiro → último dia do mês).
 */
export function calendarDayOf(monthAnchor: Date, day: number): Date {
  const last = lastDayOfMonth(monthAnchor).getDate();
  const safe = Math.min(Math.max(day, 1), last);
  return setDate(startOfMonth(monthAnchor), safe);
}

function resolveCfg(c: DPScheduleConfig | null | undefined) {
  return { ...DEFAULTS, ...(c ?? {}) };
}

/** Data de pagamento do salário (líquido ou saldo) — referência = mês de competência. */
export function salaryPaymentDate(competencyMonth: Date, c?: DPScheduleConfig | null): Date {
  const cfg = resolveCfg(c);
  // Salário sai no mês SEGUINTE ao da competência.
  const target = addMonths(startOfMonth(competencyMonth), 1);
  if (cfg.salary_payment_basis === "calendar_day") {
    return calendarDayOf(target, cfg.salary_payment_day);
  }
  return nthBusinessDay(target, cfg.salary_payment_day);
}

/** Data do adiantamento (vale) — dentro do mês de competência. Apenas se `advance_enabled`. */
export function advancePaymentDate(competencyMonth: Date, c?: DPScheduleConfig | null): Date {
  const cfg = resolveCfg(c);
  return calendarDayOf(startOfMonth(competencyMonth), cfg.advance_payment_day);
}

/** Vencimento da GPS (INSS+RAT+terceiros) — sempre no mês seguinte ao da competência. */
export function inssDueDate(competencyMonth: Date, c?: DPScheduleConfig | null): Date {
  const cfg = resolveCfg(c);
  return calendarDayOf(addMonths(startOfMonth(competencyMonth), 1), cfg.inss_due_day);
}

/** Vencimento da GRF (FGTS) — mês seguinte. */
export function fgtsDueDate(competencyMonth: Date, c?: DPScheduleConfig | null): Date {
  const cfg = resolveCfg(c);
  return calendarDayOf(addMonths(startOfMonth(competencyMonth), 1), cfg.fgts_due_day);
}

/** Vencimento do DARF de IRRF — mês seguinte. */
export function irrfDueDate(competencyMonth: Date, c?: DPScheduleConfig | null): Date {
  const cfg = resolveCfg(c);
  return calendarDayOf(addMonths(startOfMonth(competencyMonth), 1), cfg.irrf_due_day);
}

/**
 * Crédito de benefícios (VT/VR/VA): por padrão último dia útil do mês ANTERIOR
 * à competência. Se `benefits_payment_day > 0`, usa esse dia calendário do
 * mês anterior.
 */
export function benefitsPaymentDate(competencyMonth: Date, c?: DPScheduleConfig | null): Date {
  const cfg = resolveCfg(c);
  const previousMonth = addMonths(startOfMonth(competencyMonth), -1);
  if (cfg.benefits_payment_day === -1) return lastBusinessDayOf(previousMonth);
  return calendarDayOf(previousMonth, cfg.benefits_payment_day);
}

/** Fatura do plano de saúde — mês de competência. */
export function healthPaymentDate(competencyMonth: Date, c?: DPScheduleConfig | null): Date {
  const cfg = resolveCfg(c);
  return calendarDayOf(startOfMonth(competencyMonth), cfg.health_payment_day);
}

/** Helper para emitir todas as datas como `yyyy-MM-dd`. */
export function fmtISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
