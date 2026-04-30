/**
 * ============================================================================
 * Termination Calculation Breakdown — Auditable formula trace
 * ----------------------------------------------------------------------------
 * Espelha exatamente a lógica de `calculateTermination` mas, em vez de só
 * devolver os valores, devolve a memória de cálculo de cada verba (fórmula
 * textual + variáveis usadas + resultado).
 *
 * Use no histórico/detalhe de rescisão para mostrar ao CFO e ao colaborador
 * COMO cada número foi calculado.
 * ============================================================================
 */

import { differenceInMonths } from "date-fns";
import type {
  TerminationInput,
  TerminationResult,
  ContractType,
} from "./terminationCalculations";

export interface BreakdownLine {
  /** Identificador da verba (espelha as colunas de `employee_terminations`). */
  key:
    | "saldo_salario"
    | "aviso_previo"
    | "ferias_proporcionais"
    | "terco_ferias"
    | "decimo_terceiro_proporcional"
    | "multa_fgts";
  /** Rótulo legível em pt-BR (ex.: "Saldo de salário"). */
  label: string;
  /** Fundamentação legal/contratual em uma frase curta. */
  basis: string;
  /** Fórmula textual com substituições (ex.: "(R$ 5.000 / 30) × 15"). */
  formula: string;
  /** Valor calculado (já arredondado a 2 casas). */
  value: number;
  /** Mensagem opcional explicando por que veio zero (ex.: "Justa causa"). */
  zeroReason?: string;
}

export interface TerminationBreakdown {
  contract_type: ContractType;
  /** Snapshot dos parâmetros base usados no cálculo. */
  base: {
    salary: number;
    fgtsPct: number;
    monthsWorked: number;
    fullYears: number;
    monthsSinceLastVacation: number;
    monthInYear: number;
    dayInMonth: number;
  };
  lines: BreakdownLine[];
  total: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Versão didática de `calculateTermination`. Mantém os mesmos valores ao
 * centavo — qualquer divergência é bug em uma das duas funções.
 */
export function buildTerminationBreakdown(
  input: TerminationInput,
): TerminationBreakdown {
  const { salary, admissionDate, terminationDate, contractType, terminationType } = input;
  const fgtsPct = input.fgtsPct ?? 8;

  const monthsWorked = Math.max(0, differenceInMonths(terminationDate, admissionDate));
  const fullYears = Math.floor(monthsWorked / 12);
  const monthsSinceLastVacation = monthsWorked % 12;
  const monthInYear = terminationDate.getMonth() + 1;
  const dayInMonth = terminationDate.getDate();

  const base = {
    salary,
    fgtsPct,
    monthsWorked,
    fullYears,
    monthsSinceLastVacation,
    monthInYear,
    dayInMonth,
  };

  const saldoSalario = (salary / 30) * dayInMonth;
  const lines: BreakdownLine[] = [];

  // ===================== Saldo salário (todos os regimes) =====================
  lines.push({
    key: "saldo_salario",
    label: "Saldo de salário",
    basis: "Dias trabalhados no mês da rescisão.",
    formula: `(${fmtBRL(salary)} ÷ 30) × ${dayInMonth} dias`,
    value: round2(saldoSalario),
  });

  // ============================== PJ ==============================
  if (contractType === "PJ") {
    const avisoContratual = terminationType === "distrato_aviso" ? salary : 0;
    lines.push({
      key: "aviso_previo",
      label: "Aviso contratual",
      basis: "Cláusula do contrato de prestação de serviços (PJ).",
      formula:
        terminationType === "distrato_aviso"
          ? `1 × ${fmtBRL(salary)} (1 mês contratual)`
          : "—",
      value: round2(avisoContratual),
      zeroReason:
        terminationType !== "distrato_aviso"
          ? "Distrato imediato ou fim de contrato — sem aviso devido."
          : undefined,
    });
    const fixedZero: BreakdownLine[] = [
      {
        key: "ferias_proporcionais",
        label: "Férias proporcionais",
        basis: "Inaplicável a PJ — relação cível, não trabalhista.",
        formula: "—",
        value: 0,
        zeroReason: "Regime PJ não gera férias.",
      },
      {
        key: "terco_ferias",
        label: "1/3 sobre férias",
        basis: "Inaplicável a PJ.",
        formula: "—",
        value: 0,
        zeroReason: "Regime PJ não gera férias.",
      },
      {
        key: "decimo_terceiro_proporcional",
        label: "13º proporcional",
        basis: "Inaplicável a PJ.",
        formula: "—",
        value: 0,
        zeroReason: "Regime PJ não gera 13º.",
      },
      {
        key: "multa_fgts",
        label: "Multa FGTS",
        basis: "Inaplicável a PJ — não há FGTS.",
        formula: "—",
        value: 0,
        zeroReason: "Regime PJ não recolhe FGTS.",
      },
    ];
    lines.push(...fixedZero);
    const total = round2(saldoSalario + avisoContratual);
    return { contract_type: "PJ", base, lines, total };
  }

  // ============================ Estágio ============================
  if (contractType === "estagio") {
    const recessoProp = (salary / 12) * monthsSinceLastVacation;
    lines.push({
      key: "aviso_previo",
      label: "Aviso prévio",
      basis: "Inaplicável a estágio (Lei 11.788).",
      formula: "—",
      value: 0,
      zeroReason: "Estágio não gera aviso prévio.",
    });
    lines.push({
      key: "ferias_proporcionais",
      label: "Recesso remunerado proporcional",
      basis: "Lei 11.788, art. 13 — 30 dias a cada 12 meses, proporcional.",
      formula: `(${fmtBRL(salary)} ÷ 12) × ${monthsSinceLastVacation} mês(es) desde último recesso`,
      value: round2(recessoProp),
    });
    lines.push(
      {
        key: "terco_ferias",
        label: "1/3 sobre recesso",
        basis: "Não previsto na Lei do Estágio.",
        formula: "—",
        value: 0,
        zeroReason: "Estágio não tem 1/3 constitucional.",
      },
      {
        key: "decimo_terceiro_proporcional",
        label: "13º proporcional",
        basis: "Inaplicável a estágio.",
        formula: "—",
        value: 0,
        zeroReason: "Estágio não recebe 13º.",
      },
      {
        key: "multa_fgts",
        label: "Multa FGTS",
        basis: "Inaplicável a estágio.",
        formula: "—",
        value: 0,
        zeroReason: "Estágio não recolhe FGTS.",
      },
    );
    const total = round2(saldoSalario + recessoProp);
    return { contract_type: "estagio", base, lines, total };
  }

  // ============================== CLT ==============================
  const diasAviso = terminationType === "sem_justa_causa" ? 30 + fullYears * 3 : 0;
  const avisoPrevio =
    terminationType === "sem_justa_causa" ? (salary / 30) * diasAviso : 0;

  lines.push({
    key: "aviso_previo",
    label: "Aviso prévio indenizado",
    basis:
      "CLT art. 487/488 — 30 dias + 3 dias por ano completo (apenas em demissão sem justa causa).",
    formula:
      terminationType === "sem_justa_causa"
        ? `(${fmtBRL(salary)} ÷ 30) × ${diasAviso} dias (30 + ${fullYears} ano(s) × 3)`
        : "—",
    value: round2(avisoPrevio),
    zeroReason:
      terminationType !== "sem_justa_causa"
        ? `Tipo "${terminationType.replace("_", " ")}" — aviso prévio não devido.`
        : undefined,
  });

  const feriasProp =
    terminationType !== "com_justa_causa"
      ? (salary / 12) * monthsSinceLastVacation
      : 0;
  lines.push({
    key: "ferias_proporcionais",
    label: "Férias proporcionais",
    basis: "CLT art. 146 — 1/12 por mês trabalhado desde as últimas férias.",
    formula:
      terminationType !== "com_justa_causa"
        ? `(${fmtBRL(salary)} ÷ 12) × ${monthsSinceLastVacation} mês(es) desde últimas férias`
        : "—",
    value: round2(feriasProp),
    zeroReason:
      terminationType === "com_justa_causa"
        ? "Justa causa — empregado perde direito a férias proporcionais."
        : undefined,
  });

  const terco = feriasProp / 3;
  lines.push({
    key: "terco_ferias",
    label: "1/3 constitucional sobre férias",
    basis: "CF art. 7º, XVII — 1/3 sobre as férias proporcionais.",
    formula:
      feriasProp > 0 ? `${fmtBRL(round2(feriasProp))} ÷ 3` : "—",
    value: round2(terco),
    zeroReason: feriasProp === 0 ? "Sem férias proporcionais nesta rescisão." : undefined,
  });

  const decimo =
    terminationType !== "com_justa_causa" ? (salary / 12) * monthInYear : 0;
  lines.push({
    key: "decimo_terceiro_proporcional",
    label: "13º salário proporcional",
    basis: "Lei 4.090/62 — 1/12 por mês no ano corrente até a rescisão.",
    formula:
      terminationType !== "com_justa_causa"
        ? `(${fmtBRL(salary)} ÷ 12) × ${monthInYear} mês(es) no ano`
        : "—",
    value: round2(decimo),
    zeroReason:
      terminationType === "com_justa_causa"
        ? "Justa causa — empregado perde direito a 13º proporcional."
        : undefined,
  });

  const fgtsMensal = salary * (fgtsPct / 100);
  const fgtsAcumulado = fgtsMensal * monthsWorked;
  const multaPct =
    terminationType === "sem_justa_causa"
      ? 40
      : terminationType === "acordo"
      ? 20
      : 0;
  const multa = (fgtsAcumulado * multaPct) / 100;

  lines.push({
    key: "multa_fgts",
    label: "Multa rescisória sobre FGTS",
    basis:
      "Lei 8.036/90 — 40% (sem justa causa) ou 20% (acordo, Lei 13.467/17) sobre o saldo FGTS estimado.",
    formula:
      multaPct > 0
        ? `${fmtBRL(salary)} × ${fgtsPct}% × ${monthsWorked} mês(es) × ${multaPct}%`
        : "—",
    value: round2(multa),
    zeroReason:
      multaPct === 0
        ? `Tipo "${terminationType.replace("_", " ")}" — sem multa devida.`
        : undefined,
  });

  const total = round2(
    saldoSalario + avisoPrevio + feriasProp + terco + decimo + multa,
  );

  return { contract_type: "CLT", base, lines, total };
}

/**
 * Reconstrói o breakdown a partir de um registro persistido em
 * `employee_terminations` + dados do colaborador.
 *
 * IMPORTANTE: usa o salário/admissão atuais do colaborador. Para auditoria
 * de rescisões antigas onde o salário mudou, considere persistir um snapshot
 * do salário na própria tabela `employee_terminations` (TODO).
 */
export function rebuildBreakdownFromRecord(
  termination: {
    termination_date: string;
    type: string;
    contract_type: string | null;
  },
  employee: {
    salary?: number | null;
    salario?: number | null;
    base_salary?: number | null;
    admission_date?: string | null;
    data_admissao?: string | null;
    contract_type?: string | null;
  },
  fgtsPct = 8,
): TerminationBreakdown | null {
  const salary = Number(
    employee.salary ?? employee.salario ?? employee.base_salary ?? 0,
  );
  const admissionRaw = employee.admission_date ?? employee.data_admissao ?? null;
  if (!admissionRaw || !salary) return null;

  const regime = (termination.contract_type ?? employee.contract_type ?? "CLT") as ContractType;

  return buildTerminationBreakdown({
    salary,
    admissionDate: new Date(admissionRaw),
    terminationDate: new Date(termination.termination_date),
    contractType: regime,
    terminationType: termination.type as TerminationInput["terminationType"],
    fgtsPct,
  });
}

/**
 * Deriva um breakdown SOMENTE com os valores persistidos (sem re-cálculo).
 * Útil quando o salário/admissão atual não bate mais com o histórico — ainda
 * mostramos os números reais cobrados, sem fórmula "viva".
 */
export function breakdownFromPersistedValues(record: {
  contract_type: string | null;
  saldo_salario?: number | null;
  aviso_previo?: number | null;
  ferias_proporcionais?: number | null;
  terco_ferias?: number | null;
  decimo_terceiro_proporcional?: number | null;
  multa_fgts?: number | null;
  total_rescisao?: number | null;
}): Pick<TerminationBreakdown, "contract_type" | "lines" | "total"> {
  const regime = (record.contract_type ?? "CLT") as ContractType;
  const lines: BreakdownLine[] = [
    { key: "saldo_salario", label: "Saldo de salário", basis: "", formula: "—", value: Number(record.saldo_salario || 0) },
    { key: "aviso_previo", label: "Aviso prévio / contratual", basis: "", formula: "—", value: Number(record.aviso_previo || 0) },
    { key: "ferias_proporcionais", label: regime === "estagio" ? "Recesso proporcional" : "Férias proporcionais", basis: "", formula: "—", value: Number(record.ferias_proporcionais || 0) },
    { key: "terco_ferias", label: "1/3 sobre férias", basis: "", formula: "—", value: Number(record.terco_ferias || 0) },
    { key: "decimo_terceiro_proporcional", label: "13º proporcional", basis: "", formula: "—", value: Number(record.decimo_terceiro_proporcional || 0) },
    { key: "multa_fgts", label: "Multa FGTS", basis: "", formula: "—", value: Number(record.multa_fgts || 0) },
  ];
  return { contract_type: regime, lines, total: Number(record.total_rescisao || 0) };
}
