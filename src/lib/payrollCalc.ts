/**
 * Payroll net-salary calculator — single source of truth.
 *
 * Used by both the formal payroll close (`DPFolha.handleCalcPayroll`) and the
 * virtual cash-flow projections (`usePayrollProjections`). Keeps holerite,
 * folha fechada e fluxo de caixa alinhados com a mesma fórmula.
 */
import { calcINSSEmpregado, calcIRRF } from "@/hooks/useDP";

export interface PayrollEventInput {
  signal: "provento" | "desconto";
  value: number;
  /** Se true, entra na base do INSS/IRRF (HE, adic. noturno, comissão, bônus). */
  tributavel: boolean;
  event_type?: string;
}

export interface PayrollCalcInput {
  salaryBase: number;
  contractType?: string;
  vtBruto?: number;
  vtDescontoPct?: number;
  events?: PayrollEventInput[];
  /** % de adiantamento (vale) já pago no dia 20 — debitado do líquido final. */
  advancePct?: number;
  advanceEnabled?: boolean;
}

export interface PayrollCalcResult {
  bruto: number;
  proventosTributaveis: number;
  proventosNaoTributaveis: number;
  descontosVariaveis: number;
  inssEmp: number;
  irrf: number;
  vtDesconto: number;
  /** Valor pago no dia 20 (mês de competência). 0 se adiantamento desativado. */
  adiantamento: number;
  /** Valor pago no 5º dia útil do mês seguinte (saldo). */
  saldo: number;
  /** Valor total líquido do colaborador (adiantamento + saldo). */
  liquido: number;
}

/**
 * Calcula líquido do colaborador para um mês de competência.
 *
 * Regras MECE:
 *  - PJ: pagamento bruto único, sem encargos do empregado.
 *  - INSS/IRRF do empregado incidem sobre `salário base + proventos tributáveis`.
 *  - VT desconto limitado a 6% do salário base, capado pelo VT bruto.
 *  - Descontos variáveis e adiantamento reduzem o saldo final, não a base de
 *    cálculo dos tributos.
 */
export function calcEmployeeNet(input: PayrollCalcInput): PayrollCalcResult {
  const salary = Number(input.salaryBase || 0);
  const isPJ = input.contractType === "PJ";
  const events = input.events ?? [];

  let proventosTributaveis = 0;
  let proventosNaoTributaveis = 0;
  let descontosVariaveis = 0;
  for (const ev of events) {
    const v = Math.max(0, Number(ev.value || 0));
    if (ev.signal === "provento") {
      if (ev.tributavel) proventosTributaveis += v;
      else proventosNaoTributaveis += v;
    } else {
      descontosVariaveis += v;
    }
  }

  if (isPJ) {
    const bruto = salary + proventosTributaveis + proventosNaoTributaveis;
    const liquido = bruto - descontosVariaveis;
    return {
      bruto,
      proventosTributaveis,
      proventosNaoTributaveis,
      descontosVariaveis,
      inssEmp: 0,
      irrf: 0,
      vtDesconto: 0,
      adiantamento: 0,
      saldo: Math.max(0, liquido),
      liquido: Math.max(0, liquido),
    };
  }

  const baseINSS = salary + proventosTributaveis;
  const inssEmp = calcINSSEmpregado(baseINSS);
  const baseIRRF = baseINSS - inssEmp;
  const irrf = calcIRRF(baseIRRF);

  const vtBruto = Math.max(0, Number(input.vtBruto ?? 0));
  const vtDescontoPct = (input.vtDescontoPct ?? 6) / 100;
  const vtDesconto = vtBruto > 0 ? Math.min(salary * vtDescontoPct, vtBruto) : 0;

  const bruto =
    salary + proventosTributaveis + proventosNaoTributaveis;

  const liquidoBruto =
    bruto - inssEmp - irrf - vtDesconto - descontosVariaveis;

  const liquido = Math.max(0, liquidoBruto);

  // Adiantamento (vale): % do líquido — pago no mês de competência.
  let adiantamento = 0;
  if (input.advanceEnabled && (input.advancePct ?? 0) > 0) {
    adiantamento = round2(liquido * ((input.advancePct ?? 0) / 100));
  }
  const saldo = round2(liquido - adiantamento);

  return {
    bruto: round2(bruto),
    proventosTributaveis: round2(proventosTributaveis),
    proventosNaoTributaveis: round2(proventosNaoTributaveis),
    descontosVariaveis: round2(descontosVariaveis),
    inssEmp: round2(inssEmp),
    irrf: round2(irrf),
    vtDesconto: round2(vtDesconto),
    adiantamento,
    saldo,
    liquido: round2(liquido),
  };
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
