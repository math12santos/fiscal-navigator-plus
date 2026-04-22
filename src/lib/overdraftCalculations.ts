/**
 * Lógica de cálculo de Cheque Especial.
 *
 * Regras:
 * - O cheque especial não tem vencimento/renovação contratual.
 * - O saldo negativo de uma conta com cheque especial pode ser composto por:
 *     a) Uso efetivo do limite (consome a linha aprovada e gera juros).
 *     b) Provisionamento de pagamentos (saldo contábil negativo por compromissos
 *        já lançados que ainda não saíram do banco — não consome limite).
 * - Os juros são cobrados diariamente sobre o saldo devedor (uso do limite).
 * - O fechamento ocorre no primeiro dia do mês subsequente, somando juros do mês
 *   anterior ao saldo devedor (capitalização mensal).
 *
 * Conversão de taxa mensal para diária: usamos juros compostos
 *   taxa_diaria = (1 + taxa_mensal) ^ (1/30) - 1
 */

export type LimitType =
  | "cheque_especial"
  | "capital_giro"
  | "conta_garantida"
  | "antecipacao_recebiveis"
  | "outros";

/** Converte taxa mensal (em %) para taxa diária equivalente (em decimal). */
export function monthlyRateToDaily(monthlyPct: number): number {
  if (!monthlyPct || monthlyPct <= 0) return 0;
  const monthly = monthlyPct / 100;
  return Math.pow(1 + monthly, 1 / 30) - 1;
}

/**
 * Calcula a composição do saldo negativo, separando uso de limite vs.
 * provisionamento de pagamentos.
 *
 * @param saldoAtual          Saldo atual da conta (pode ser negativo).
 * @param provisaoPagamentos  Total de pagamentos já lançados mas não liquidados.
 * @returns                   Quanto está em uso do limite e quanto é provisão.
 */
export function decomposeNegativeBalance(
  saldoAtual: number,
  provisaoPagamentos: number = 0
): { usoLimite: number; provisao: number; saldoLivre: number } {
  // Se saldo positivo, não há uso de limite
  if (saldoAtual >= 0) {
    return { usoLimite: 0, provisao: 0, saldoLivre: saldoAtual };
  }
  const negativo = Math.abs(saldoAtual);
  const provisao = Math.min(provisaoPagamentos, negativo);
  const usoLimite = Math.max(0, negativo - provisao);
  return { usoLimite, provisao, saldoLivre: 0 };
}

/**
 * Calcula juros diários acumulados sobre o uso do limite.
 *
 * @param usoLimite               Valor utilizado do limite (positivo).
 * @param taxaJurosMensalPct      Taxa mensal cadastrada em %.
 * @param diasNoMes               Quantos dias o saldo permaneceu devedor.
 * @returns                       Juros acumulados em R$.
 */
export function calculateDailyInterest(
  usoLimite: number,
  taxaJurosMensalPct: number,
  diasNoMes: number
): number {
  if (usoLimite <= 0 || taxaJurosMensalPct <= 0 || diasNoMes <= 0) return 0;
  const taxaDiaria = monthlyRateToDaily(taxaJurosMensalPct);
  // juros simples diários sobre o saldo médio aproximado (modelo prático)
  return usoLimite * taxaDiaria * diasNoMes;
}

/**
 * Estima o desconto mensal que será debitado no primeiro dia do mês subsequente,
 * considerando que a utilização do mês corrente permanece estável até o fechamento.
 *
 * @param usoLimite          Uso atual do limite (saldo devedor estimado).
 * @param taxaMensalPct      Taxa cadastrada (% a.m.).
 * @param diasUtilizadosMes  Dias do mês corrente em que o limite foi utilizado.
 *                           Quando omitido, assume mês cheio (30 dias).
 */
export function estimateMonthlyClosingCharge(
  usoLimite: number,
  taxaMensalPct: number,
  diasUtilizadosMes: number = 30
): number {
  return calculateDailyInterest(usoLimite, taxaMensalPct, diasUtilizadosMes);
}

/**
 * Calcula a próxima data de fechamento (primeiro dia do mês subsequente).
 */
export function getNextClosingDate(reference: Date = new Date()): Date {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  return new Date(y, m + 1, 1);
}

/**
 * Disponibilidade real de capital de giro para uma conta.
 *
 * - Para cheque especial: saldo positivo + (limite total - uso já comprometido).
 * - Para outras linhas:   saldo + (limite_credito - limite_utilizado).
 */
export function calculateAvailability(params: {
  saldoAtual: number;
  limiteTotal: number;
  limiteUtilizado: number;
  limiteTipo: LimitType;
  provisaoPagamentos?: number;
}): {
  usoLimiteAtual: number;
  limiteDisponivel: number;
  capitalGiroDisponivel: number;
  saldoLivre: number;
} {
  const { saldoAtual, limiteTotal, limiteUtilizado, limiteTipo, provisaoPagamentos = 0 } = params;

  if (limiteTipo === "cheque_especial") {
    // No cheque especial, o "uso" é derivado do próprio saldo negativo
    const { usoLimite, saldoLivre } = decomposeNegativeBalance(saldoAtual, provisaoPagamentos);
    const usoTotalLimite = Math.max(usoLimite, limiteUtilizado);
    const limiteDisponivel = Math.max(0, limiteTotal - usoTotalLimite);
    return {
      usoLimiteAtual: usoTotalLimite,
      limiteDisponivel,
      capitalGiroDisponivel: saldoLivre + limiteDisponivel,
      saldoLivre,
    };
  }

  // Outras linhas: limite é independente do saldo da conta
  const limiteDisponivel = Math.max(0, limiteTotal - limiteUtilizado);
  return {
    usoLimiteAtual: limiteUtilizado,
    limiteDisponivel,
    capitalGiroDisponivel: saldoAtual + limiteDisponivel,
    saldoLivre: Math.max(0, saldoAtual),
  };
}

/** Formata moeda em BRL */
export const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
