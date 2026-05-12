---
name: Cash Liquidity Report
description: PDF e KPIs de Posição de Caixa exibem Liquidez (capital de giro) ao invés de saldo+limite cru — contas negativas não reduzem o caixa do consolidado
type: feature
---

`AgingListTab` calcula liquidez por conta via `calculateAvailability` (overdraftCalculations.ts) e clampa em zero: `liquidez = max(0, capitalGiroDisponivel)`.

Convenção MECE: contas negativas (cheque especial em uso, conta corrente devedora) **não subtraem** do consolidado. Elas podem permanecer negativas enquanto outras contas têm liquidez para pagamentos. O limite disponível ainda contribui.

`bankTotals.liquidezTotal` substitui `disponibilidadeTotal` no KPI principal (rótulo "Liquidez (capital de giro)"). Tabelas por org e por conta exibem colunas: Saldo / Limite disp. / Liquidez. `cashPositionPdf.ts` adiciona `liquidez` em `CashPositionAccount` e `CashPositionByOrg`, e `totals.liquidez` no input — Resumo Financeiro lidera com "Liquidez Total"; per-org fecha o total na coluna Liquidez (verde teal).
