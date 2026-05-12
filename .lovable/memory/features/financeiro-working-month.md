---
name: Financeiro Working Month
description: FinanceiroMonthContext compartilha workingMonth entre MonthClosingReadinessCard e abas AP/AR/Conciliação/Contas Bancárias com banner de status e bloqueio de edição em mês fechado
type: feature
---

`src/contexts/FinanceiroMonthContext.tsx` provê `workingMonth` (yyyy-MM, default mês corrente, reset ao trocar org). Provider envolve `/financeiro` em `Financeiro.tsx`.

`MonthClosingReadinessCard` consome o contexto (não tem mais state local), mostra badge Aberto/Fechado, troca para "Reabrir mês" quando fechado, e os 3 cartões (Extrato/AP/AR) são botões que chamam `onNavigateTab('conciliacao'|'pagar'|'receber')`.

`WorkingMonthBanner` (em `src/components/financeiro/`) é renderizado no topo de ContasAPagar, ContasAReceber, ConciliacaoTab e ContasBancariasTab. Esconde-se quando ainda no mês corrente sem interação manual. Expõe `useWorkingMonthClosed()` que desabilita botões de criar/importar.

`useFinanceiroMonthFilter` filtra `FinanceiroEntry[]` pelo `workingMonth` (preferência: `data_realizada` → `data_prevista` → `data_vencimento`). `computeFinanceiroTotals` recalcula KPIs MECE (mesma fórmula de `useFinanceiro`) para a lista filtrada.

ConciliacaoTab traduz `workingMonth` em `from`/`to` (startOfMonth/endOfMonth) passados para `useConciliacao`.
