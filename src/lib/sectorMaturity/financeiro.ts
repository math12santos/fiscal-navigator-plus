// Avaliação de maturidade do setor Financeiro.
// Função pura — recebe os dados já carregados pelo hook e retorna o resultado.
// Estrutura idêntica ao evaluateDP: 50 (completude) + 25 (atualização) + 25 (rotinas).

import {
  ChecklistItem,
  SectorMaturityResult,
  maturityLabelFromScore,
} from "./types";
import { DEFAULT_TARGETS, SectorMaturityTargets } from "./targets";

interface EvaluateFinanceiroInput {
  targets?: SectorMaturityTargets;
  // Estrutura
  chartAccounts: any[];           // chart_of_accounts (active)
  costCenters: any[];             // cost_centers
  bankAccounts: any[];            // bank_accounts (active)
  entities: any[];                // entities (fornecedores + clientes)
  groupingMacros: any[];          // grouping_macrogroups
  groupingGroups: any[];          // grouping_groups
  groupingRules: any[];           // grouping_rules (enabled)
  contractsActive: any[];         // contracts ativos com recorrência
  // Movimentação
  cashflowMonth: any[];           // cashflow_entries do mês corrente
  cashflowPrevMonth: any[];       // cashflow_entries do mês anterior
  overdueEntries: any[];          // cashflow_entries previsto com data_vencimento < hoje-30d
  // Governança
  prevPeriod: any | null;         // fiscal_periods do mês anterior (status)
  // Rotinas (mês corrente)
  routinesGenerated: number;
  routinesCompleted: number;
  routinesOverdue: number;
  refDate?: Date;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
}

export function evaluateFinanceiro(input: EvaluateFinanceiroInput): SectorMaturityResult {
  const today = input.refDate ?? new Date();
  const targets = input.targets ?? DEFAULT_TARGETS;
  const items: ChecklistItem[] = [];
  const push = (i: ChecklistItem) => items.push({ ...i, done: i.earned >= i.weight });

  // ============== A. COMPLETUDE (50 pts) ==============

  // 1. Plano de contas com pelo menos 1 sintética + 1 analítica em receita e despesa (8 pts)
  {
    const accs = input.chartAccounts.filter((a: any) => a.active);
    const has = (nature: string, synthetic: boolean) =>
      accs.some((a: any) => (a.nature === nature || a.accounting_class === nature) && a.is_synthetic === synthetic);
    // Tolerante: usa nature OU accounting_class — busca presença de receita/despesa em ambos os modos
    const hasReceitaSynth = accs.some((a: any) => (a.nature === "receita") && a.is_synthetic === true);
    const hasReceitaAnalytic = accs.some((a: any) => (a.nature === "receita") && a.is_synthetic === false);
    const hasDespesaSynth = accs.some((a: any) => (a.nature === "despesa") && a.is_synthetic === true);
    const hasDespesaAnalytic = accs.some((a: any) => (a.nature === "despesa") && a.is_synthetic === false);
    const checks = [hasReceitaSynth, hasReceitaAnalytic, hasDespesaSynth, hasDespesaAnalytic];
    const ok = checks.filter(Boolean).length;
    const earned = 8 * pct(ok, checks.length);
    push({
      key: "fin-chart-accounts",
      label: "Plano de contas estruturado (receitas e despesas)",
      category: "completude",
      weight: 8,
      earned,
      hint: "Mínimo: 1 conta sintética e 1 analítica para receita e despesa.",
      ctaTab: "config-chart",
      detail: `${ok}/4 verificações ok`,
    });
  }

  // 2. Centros de custo cadastrados (6 pts)
  {
    const count = input.costCenters.filter((c: any) => c.active !== false).length;
    const earned = count > 0 ? 6 : 0;
    push({
      key: "fin-cost-centers",
      label: "Centros de custo cadastrados",
      category: "completude",
      weight: 6,
      earned,
      hint: "Estrutura mínima de áreas/CC para análise gerencial.",
      ctaTab: "config-cc",
      detail: `${count} ativo(s)`,
    });
  }

  // 3. Contas bancárias cadastradas (6 pts)
  {
    const count = input.bankAccounts.filter((b: any) => b.active !== false).length;
    const earned = count > 0 ? 6 : 0;
    push({
      key: "fin-bank-accounts",
      label: "Contas bancárias cadastradas",
      category: "completude",
      weight: 6,
      earned,
      hint: "Pelo menos uma conta bancária ativa.",
      ctaTab: "contas-bancarias",
      detail: `${count} ativa(s)`,
    });
  }

  // 4. Saldos iniciais informados (6 pts)
  {
    const active = input.bankAccounts.filter((b: any) => b.active !== false);
    const ok = active.filter((b: any) => b.saldo_atualizado_em).length;
    const total = active.length;
    const earned = total > 0 ? 6 * pct(ok, total) : 0;
    push({
      key: "fin-bank-initial-balance",
      label: "Saldos bancários informados",
      category: "completude",
      weight: 6,
      earned,
      hint: "Cada conta bancária precisa de saldo inicial registrado.",
      ctaTab: "contas-bancarias",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 5. Cadastro de entidades (≥3 fornecedores+clientes) (6 pts)
  {
    const count = input.entities.length;
    const target = 3;
    const earned = 6 * pct(Math.min(count, target), target);
    push({
      key: "fin-entities",
      label: "Cadastro de fornecedores e clientes",
      category: "completude",
      weight: 6,
      earned,
      hint: "Catálogo mínimo (3) para classificar lançamentos.",
      ctaTab: "config-entities",
      detail: `${count} cadastrado(s)`,
    });
  }

  // 6. Aglutinação configurada (≥1 macro + ≥1 grupo + ≥1 regra) (6 pts)
  {
    const macros = input.groupingMacros.length;
    const groups = input.groupingGroups.length;
    const rules = input.groupingRules.filter((r: any) => r.enabled !== false).length;
    const ok = (macros > 0 ? 1 : 0) + (groups > 0 ? 1 : 0) + (rules > 0 ? 1 : 0);
    const earned = 6 * pct(ok, 3);
    push({
      key: "fin-grouping",
      label: "Aglutinação financeira configurada",
      category: "completude",
      weight: 6,
      earned,
      hint: "Macrogrupos, grupos e ao menos uma regra ativa.",
      ctaTab: "config-grouping",
      detail: `${macros} macros · ${groups} grupos · ${rules} regras`,
    });
  }

  // 7. Contratos recorrentes ativos (6 pts)
  {
    const count = input.contractsActive.filter(
      (c: any) => (c.status === "Ativo" || c.status === "ativo") && c.tipo_recorrencia && c.tipo_recorrencia !== "unica"
    ).length;
    const earned = count > 0 ? 6 : 0;
    push({
      key: "fin-contracts-recurring",
      label: "Contratos recorrentes alimentando o fluxo",
      category: "completude",
      weight: 6,
      earned,
      hint: "Pelo menos um contrato recorrente ativo (gera projeção automática).",
      ctaTab: "contratos",
      detail: `${count} contrato(s)`,
    });
  }

  // 8. Forma de pagamento padronizada (6 pts) — % de entries com forma_pagamento
  {
    const total = input.cashflowMonth.length;
    const ok = input.cashflowMonth.filter((e: any) => e.forma_pagamento).length;
    // Se não há lançamentos, pontuação cheia (não dá para penalizar empresa sem operação no mês)
    const earned = total > 0 ? 6 * pct(ok, total) : 6;
    push({
      key: "fin-payment-method",
      label: "Forma de pagamento padronizada nos lançamentos",
      category: "completude",
      weight: 6,
      earned,
      hint: "Lançamentos do mês com forma de pagamento informada.",
      ctaTab: "pagar",
      detail: total > 0 ? `${ok}/${total}` : "n/a",
    });
  }

  // ============== B. ATUALIZAÇÃO (25 pts) ==============

  // 1. Período fiscal do mês anterior fechado (8 pts)
  if (targets.period_close_required) {
    const closed = input.prevPeriod?.status === "closed";
    const earned = closed ? 8 : 0;
    push({
      key: "fin-period-closed",
      label: "Período fiscal do mês anterior fechado",
      category: "atualizacao",
      weight: 8,
      earned,
      hint: "Trave o mês anterior para preservar o histórico.",
      ctaTab: "fluxo-caixa",
      detail: input.prevPeriod ? `status: ${input.prevPeriod.status}` : "não fechado",
    });
  } else {
    // Política da org: não exige fechamento — concede pontos cheios para não penalizar
    push({
      key: "fin-period-closed",
      label: "Período fiscal do mês anterior fechado",
      category: "atualizacao",
      weight: 8,
      earned: 8,
      hint: "Política da organização: fechamento de período não exigido.",
      ctaTab: "fluxo-caixa",
      detail: "não exigido",
    });
  }


  // 2. Saldos bancários atualizados (≤ N dias) (6 pts)
  {
    const active = input.bankAccounts.filter((b: any) => b.active !== false);
    const cutoff = new Date(today.getTime() - targets.bank_freshness_days * 24 * 3600 * 1000);
    const ok = active.filter((b: any) => b.saldo_atualizado_em && new Date(b.saldo_atualizado_em) >= cutoff).length;
    const total = active.length;
    const earned = total > 0 ? 6 * pct(ok, total) : 0;
    push({
      key: "fin-bank-fresh",
      label: `Saldos bancários atualizados nos últimos ${targets.bank_freshness_days} dias`,
      category: "atualizacao",
      weight: 6,
      earned,
      hint: `Atualize o saldo de cada conta a cada ${targets.bank_freshness_days} dias.`,
      ctaTab: "contas-bancarias",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 3. Lançamentos do mês classificados (6 pts) — account_id + cost_center_id
  {
    const total = input.cashflowMonth.length;
    const ok = input.cashflowMonth.filter((e: any) => e.account_id && e.cost_center_id).length;
    const targetPct = targets.classification_target_pct;
    const rate = total > 0 ? ok / total : 1;
    const earned = total > 0 ? 6 * Math.min(1, rate / Math.max(0.01, targetPct)) : 6;
    push({
      key: "fin-classification",
      label: "Lançamentos do mês classificados",
      category: "atualizacao",
      weight: 6,
      earned,
      hint: `Meta: ${Math.round(targetPct * 100)}% das entradas com conta contábil e centro de custo.`,
      ctaTab: "pagar",
      detail: total > 0 ? `${ok}/${total} (${Math.round(rate * 100)}%)` : "n/a",
    });
  }

  // 4. Sem atrasos críticos > N dias (5 pts)
  {
    const overdue = input.overdueEntries.length;
    const penalty = Math.min(1, overdue / Math.max(1, targets.overdue_max_count));
    const earned = 5 * (1 - penalty);
    push({
      key: "fin-no-overdue",
      label: `Sem lançamentos vencidos há mais de ${targets.overdue_critical_days} dias`,
      category: "atualizacao",
      weight: 5,
      earned,
      hint: "Resolva (pagar, renegociar ou baixar) lançamentos antigos.",
      ctaTab: "aging",
      detail: overdue > 0 ? `${overdue} crítico(s)` : "tudo em dia",
    });
  }

  // ============== C. ROTINAS (25 pts) ==============

  // 1. Conciliação do mês anterior (10 pts) — % entries do mês anterior realizados
  {
    const total = input.cashflowPrevMonth.length;
    const realizados = input.cashflowPrevMonth.filter(
      (e: any) => e.status === "realizado" && e.data_realizada
    ).length;
    let earned = 0;
    let detail = "sem lançamentos no mês anterior";
    if (total > 0) {
      const rate = realizados / total;
      earned = 10 * Math.min(1, rate / Math.max(0.01, targets.reconciliation_target_pct));
      detail = `${realizados}/${total} realizados (${Math.round(rate * 100)}%)`;
    }
    push({
      key: "fin-reconciliation",
      label: "Conciliação do mês anterior",
      category: "rotinas",
      weight: 10,
      earned,
      hint: `Meta: ${Math.round(targets.reconciliation_target_pct * 100)}% dos lançamentos do mês anterior realizados.`,
      ctaTab: "conciliacao",
      detail,
    });
  }

  // 2. Cumprimento das requests financeiras do mês (15 pts)
  {
    const total = input.routinesGenerated;
    const completed = input.routinesCompleted;
    const overdue = input.routinesOverdue;
    let earned = 0;
    let detail = "sem solicitações no mês";
    if (total > 0) {
      const completionRate = completed / total;
      const overdueRate = overdue / total;
      const tolerated = Math.max(0, overdueRate - targets.routines_overdue_tolerance_pct);
      const overduePenalty = Math.min(0.5, tolerated * 0.5);
      const adjusted = Math.max(0, completionRate - overduePenalty);
      earned = 15 * Math.min(1, adjusted / Math.max(0.01, targets.routines_target_pct));
      detail = `${completed}/${total} concluídas${overdue > 0 ? ` • ${overdue} atrasadas` : ""}`;
    } else {
      // Sem solicitações no mês — neutro (metade)
      earned = 7.5;
    }
    push({
      key: "fin-requests",
      label: "Cumprimento das solicitações financeiras",
      category: "rotinas",
      weight: 15,
      earned,
      hint: "Solicitações de despesa/financeiro devem ser triadas no mês.",
      ctaTab: "solicitacoes",
      detail,
    });
  }

  // ============== Totais ==============
  const sumBy = (cat: string) =>
    items.filter((i) => i.category === cat).reduce((s, i) => s + i.earned, 0);

  const completeness = Math.round(sumBy("completude") * 100) / 100;
  const freshness = Math.round(sumBy("atualizacao") * 100) / 100;
  const routines = Math.round(sumBy("rotinas") * 100) / 100;
  const score = Math.round(completeness + freshness + routines);

  return {
    score,
    completeness,
    freshness,
    routines,
    label: maturityLabelFromScore(score),
    checklist: items,
  };
}
