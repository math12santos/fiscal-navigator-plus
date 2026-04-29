/**
 * Vacation calculations following Brazilian CLT rules.
 *
 * - Acquisition Period (PA / período aquisitivo) = each 12 months from admission.
 * - Concessive period (prazo concessivo) = 12 months after PA end to grant the
 *   30-day vacation. Past that → vacation must be paid in DOUBLE (CLT art. 137).
 * - Employee may sell up to 1/3 of vacation as "abono pecuniário" → max 10 days
 *   per PA (CLT art. 143).
 * - Total used (gozado + vendido) per PA <= 30 days.
 */
import { addMonths, addYears, differenceInMonths, isBefore } from "date-fns";

export type VacationStatus =
  | "gozado"
  | "agendado"
  | "em_dia"
  | "proximo_vencimento"
  | "vencido_em_dobro";

export interface VacationRecord {
  id: string;
  employee_id: string;
  periodo_aquisitivo_inicio: string; // ISO
  periodo_aquisitivo_fim: string;
  data_inicio: string | null;
  data_fim: string | null;
  dias_gozados: number | null;
  dias_vendidos: number | null;
  status?: string;
  tipo?: string | null;
}

export interface AcquisitionPeriod {
  index: number; // 1 = first PA
  inicio: Date;
  fim: Date;
  limiteConcessivo: Date; // fim + 12 months
  diasGozados: number;
  diasVendidos: number;
  diasSaldo: number; // 30 - gozados - vendidos
  status: VacationStatus;
  monthsUntilLimit: number; // negative if overdue
  hasScheduled: boolean;
  registros: VacationRecord[];
}

export interface EmployeeVacationSummary {
  employeeId: string;
  admissionDate: Date;
  periodos: AcquisitionPeriod[];
  periodosAbertos: AcquisitionPeriod[]; // diasSaldo > 0
  diasAcumulados: number; // sum of saldos in open PAs
  proximoPaAVencer: AcquisitionPeriod | null;
  proximasFeriasEm: number; // months until next PA is acquired (>0)
  proximasFeriasData: Date; // date next PA closes
  worstStatus: VacationStatus;
  needsAttention: boolean; // 2+ open PAs OR vencido OR proximo_vencimento
}

const URGENCY_MONTHS = 3;

function statusFor(
  saldo: number,
  monthsUntilLimit: number,
  hasScheduled: boolean,
): VacationStatus {
  if (saldo <= 0) return "gozado";
  if (monthsUntilLimit < 0) return "vencido_em_dobro";
  if (hasScheduled) return "agendado";
  if (monthsUntilLimit <= URGENCY_MONTHS) return "proximo_vencimento";
  return "em_dia";
}

const STATUS_RANK: Record<VacationStatus, number> = {
  gozado: 0,
  em_dia: 1,
  agendado: 2,
  proximo_vencimento: 3,
  vencido_em_dobro: 4,
};

export function computeEmployeeVacationSummary(
  admission: Date | string,
  vacations: VacationRecord[],
  today: Date = new Date(),
): EmployeeVacationSummary {
  const admissionDate = typeof admission === "string" ? new Date(admission) : admission;
  const monthsWorked = Math.max(0, differenceInMonths(today, admissionDate));
  // Number of completed acquisition periods so far (each 12 months)
  const completedPAs = Math.floor(monthsWorked / 12);

  const periodos: AcquisitionPeriod[] = [];
  for (let i = 1; i <= completedPAs; i++) {
    const inicio = addYears(admissionDate, i - 1);
    const fim = addYears(admissionDate, i);
    const limite = addMonths(fim, 12);

    const registros = vacations.filter((v) => {
      const vInicio = new Date(v.periodo_aquisitivo_inicio);
      // Match by PA start (day-month-year aligned within tolerance)
      return Math.abs(differenceInMonths(vInicio, inicio)) < 1;
    });

    const diasGozados = registros.reduce((s, r) => s + Number(r.dias_gozados || 0), 0);
    const diasVendidos = registros.reduce((s, r) => s + Number(r.dias_vendidos || 0), 0);
    const diasSaldo = Math.max(0, 30 - diasGozados - diasVendidos);
    const monthsUntilLimit = differenceInMonths(limite, today);
    const hasScheduled = registros.some(
      (r) => r.data_inicio && isBefore(today, new Date(r.data_inicio)),
    );

    periodos.push({
      index: i,
      inicio,
      fim,
      limiteConcessivo: limite,
      diasGozados,
      diasVendidos,
      diasSaldo,
      status: statusFor(diasSaldo, monthsUntilLimit, hasScheduled),
      monthsUntilLimit,
      hasScheduled,
      registros,
    });
  }

  const periodosAbertos = periodos.filter((p) => p.diasSaldo > 0);
  const diasAcumulados = periodosAbertos.reduce((s, p) => s + p.diasSaldo, 0);

  // Oldest open PA dictates the next deadline
  const proximoPaAVencer = periodosAbertos.length
    ? periodosAbertos.reduce((acc, p) =>
        p.limiteConcessivo < acc.limiteConcessivo ? p : acc,
      )
    : null;

  // Next PA acquisition date = admission + (completedPAs + 1) years
  const proximasFeriasData = addYears(admissionDate, completedPAs + 1);
  const proximasFeriasEm = Math.max(0, differenceInMonths(proximasFeriasData, today));

  const worstStatus = periodos.length
    ? periodos.reduce<VacationStatus>(
        (acc, p) => (STATUS_RANK[p.status] > STATUS_RANK[acc] ? p.status : acc),
        "gozado",
      )
    : "em_dia";

  const needsAttention =
    periodosAbertos.length >= 2 ||
    worstStatus === "vencido_em_dobro" ||
    worstStatus === "proximo_vencimento";

  return {
    employeeId: vacations[0]?.employee_id ?? "",
    admissionDate,
    periodos,
    periodosAbertos,
    diasAcumulados,
    proximoPaAVencer,
    proximasFeriasEm,
    proximasFeriasData,
    worstStatus,
    needsAttention,
  };
}

export function statusLabel(s: VacationStatus): string {
  switch (s) {
    case "gozado":
      return "Gozado";
    case "agendado":
      return "Agendado";
    case "em_dia":
      return "Em dia";
    case "proximo_vencimento":
      return "Próximo do vencimento";
    case "vencido_em_dobro":
      return "Vencido — pagamento em dobro";
  }
}

export function formatMonthsUntil(months: number): string {
  if (months < 0) return `vencido há ${Math.abs(months)} ${Math.abs(months) === 1 ? "mês" : "meses"}`;
  if (months === 0) return "vence este mês";
  if (months === 1) return "em 1 mês";
  return `em ${months} meses`;
}
