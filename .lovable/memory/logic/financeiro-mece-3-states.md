---
name: Financeiro MECE 3 estados
description: AP/AR são Previsto. Botões "Pagar" registram Em pagamento. Só conciliação bancária promove para Realizado. Fechamento de mês exige 100%.
type: feature
---
**3 estados MECE em `cashflow_entries.status`**:
- `previsto` / `confirmado` → planejamento (AP/AR puros)
- `pagamento_emitido` (saída) / `recebimento_esperado` (entrada) → ação registrada, aguardando banco
- `pago` / `recebido` → confirmado pelo extrato (única via: conciliação)

**Trigger `cashflow_realize_guard`** bloqueia transição para `pago/recebido` sem `bank_statement_entries.cashflow_entry_id` vinculado, exceto via flag de sessão `app.allow_realize='on'` (setada por `reconcile_statement_entry`/`unreconcile_statement_entry`) ou `source='import_historico'`. Bloqueia também escrita direta em `valor_realizado`/`data_realizada`.

**RPCs**:
- `register_payment_issued(p_entry_id, p_data_emissao, p_meio)` — botão "Pagar/Receber"
- `undo_payment_issued(p_entry_id)` — desfaz enquanto não conciliado
- `get_month_closing_readiness(p_org, p_year_month)` → jsonb com pct_extrato/pct_ap/pct_ar/ready
- `close_fiscal_period(p_org, p_year_month)` → só fecha se ready=true

**UI**: `MonthClosingReadinessCard` no topo de `/financeiro`. KPIs em ContasAPagar/Receber: Previsto · Em pagamento · Realizado. Botão "Desfazer emissão" em linhas em pagamento.

**Solicitações de despesa** continuam criando cashflow `previsto`. Só conciliação as fecha.
