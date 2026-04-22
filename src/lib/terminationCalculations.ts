/**
 * ============================================================================
 * Termination Calculations — Pure, framework-free rescission math
 * ----------------------------------------------------------------------------
 * Lógica de cálculo de rescisão por regime contratual (CLT / PJ / estagio).
 *
 * Princípio MECE (regime define o que é devido):
 *   - PJ:      relação cível — distrato comercial. SEM FGTS, multa, 13º, férias.
 *   - estagio: Lei 11.788    — bolsa + recesso. SEM FGTS, 13º, multa.
 *   - CLT:     CLT padrão     — saldo + aviso + férias + 1/3 + 13º + multa FGTS.
 *
 * Esta função é a **fonte única da verdade** para o cálculo de rescisão e
 * deve ser usada pelo Simulador de Rescisão e por qualquer projeção futura.
 * ============================================================================
 */

import { differenceInMonths } from "date-fns";

export type ContractType = "CLT" | "PJ" | "estagio";

export type CLTTerminationType =
  | "sem_justa_causa"
  | "com_justa_causa"
  | "pedido_demissao"
  | "acordo";

export type PJTerminationType = "distrato_aviso" | "distrato_imediato" | "fim_contrato";

export type TerminationType = CLTTerminationType | PJTerminationType;

export interface TerminationInput {
  /** Salário base / bolsa / valor mensal contratado. */
  salary: number;
  /** Data de admissão (início do vínculo). */
  admissionDate: Date;
  /** Data prevista da rescisão / distrato. */
  terminationDate: Date;
  /** Regime do colaborador na data da rescisão (snapshot histórico). */
  contractType: ContractType;
  /** Tipo de rescisão (CLT) ou distrato (PJ). Ignorado para estágio. */
  terminationType: TerminationType;
  /** Percentual de FGTS configurado para a organização (default 8). */
  fgtsPct?: number;
}

export interface TerminationResult {
  contract_type: ContractType;
  saldo_salario: number;
  aviso_previo: number;
  /** Em estágio, este campo armazena o RECESSO proporcional (semântica do banco). */
  ferias_proporcionais: number;
  terco_ferias: number;
  decimo_terceiro_proporcional: number;
  multa_fgts: number;
  total_rescisao: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Calcula a rescisão respeitando estritamente o regime contratual.
 * Garante por construção que PJ e estágio NUNCA produzem FGTS, 13º ou férias.
 */
export function calculateTermination(input: TerminationInput): TerminationResult {
  const { salary, admissionDate, terminationDate, contractType, terminationType } = input;
  const fgtsPct = input.fgtsPct ?? 8;

  const monthsWorked = Math.max(0, differenceInMonths(terminationDate, admissionDate));
  const dayOfMonth = terminationDate.getDate();
  const saldoSalario = (salary / 30) * dayOfMonth;

  // ============== PJ ==============
  if (contractType === "PJ") {
    const avisoContratual = terminationType === "distrato_aviso" ? salary : 0;
    const total = saldoSalario + avisoContratual;
    return {
      contract_type: "PJ",
      saldo_salario: round2(saldoSalario),
      aviso_previo: round2(avisoContratual),
      ferias_proporcionais: 0,
      terco_ferias: 0,
      decimo_terceiro_proporcional: 0,
      multa_fgts: 0,
      total_rescisao: round2(total),
    };
  }

  // ============== Estágio ==============
  if (contractType === "estagio") {
    // Recesso remunerado proporcional (Lei 11.788, art. 13).
    const recessoProp = (salary / 12) * (monthsWorked % 12);
    const total = saldoSalario + recessoProp;
    return {
      contract_type: "estagio",
      saldo_salario: round2(saldoSalario),
      aviso_previo: 0,
      ferias_proporcionais: round2(recessoProp), // recesso ocupa o slot de férias
      terco_ferias: 0,
      decimo_terceiro_proporcional: 0,
      multa_fgts: 0,
      total_rescisao: round2(total),
    };
  }

  // ============== CLT ==============
  const anosCompletos = Math.floor(monthsWorked / 12);
  const diasAviso = terminationType === "sem_justa_causa" ? 30 + anosCompletos * 3 : 0;
  const avisoPrevio = terminationType === "sem_justa_causa" ? (salary / 30) * diasAviso : 0;

  const mesesDesdeUltimasFerias = monthsWorked % 12;
  const feriasProporcionais =
    terminationType !== "com_justa_causa" ? (salary / 12) * mesesDesdeUltimasFerias : 0;
  const tercoFerias = feriasProporcionais / 3;

  const meses13 = terminationDate.getMonth() + 1;
  const decimoTerceiro =
    terminationType !== "com_justa_causa" ? (salary / 12) * meses13 : 0;

  const fgtsMensal = salary * (fgtsPct / 100);
  const fgtsAcumulado = fgtsMensal * monthsWorked;
  const multaFGTS =
    terminationType === "sem_justa_causa"
      ? fgtsAcumulado * 0.4
      : terminationType === "acordo"
      ? fgtsAcumulado * 0.2
      : 0;

  const total =
    saldoSalario + avisoPrevio + feriasProporcionais + tercoFerias + decimoTerceiro + multaFGTS;

  return {
    contract_type: "CLT",
    saldo_salario: round2(saldoSalario),
    aviso_previo: round2(avisoPrevio),
    ferias_proporcionais: round2(feriasProporcionais),
    terco_ferias: round2(tercoFerias),
    decimo_terceiro_proporcional: round2(decimoTerceiro),
    multa_fgts: round2(multaFGTS),
    total_rescisao: round2(total),
  };
}
