---
name: Expense Requests Multi-Module
description: Botão Solicitar Despesa/Reembolso em DP/Jurídico/TI/CRM/Financeiro/Cadastros + aba Solicitações no Financeiro com aprovação que provisiona cashflow_entry, políticas e SLAs por (módulo, subtype, prioridade)
type: feature
---

`RequestExpenseButton` (sourceModule prop) emite `requests.type='expense_request'` com `reference_module=<sourceModule>` e `description` JSON `{subtype: 'expense'|'reimbursement', text, estimated_value, data_gasto?, forma_pagamento_pessoal?}`. Usar `parseRequestDescription` para ler.

Aba **Solicitações** no Financeiro (`SolicitacoesTab`): sub-tabs Pendentes/Aprovadas/Rejeitadas/Todas/Políticas&SLAs. `ApproveRequestDialog` cria `cashflow_entries` (tipo=saida, status=previsto, source='request', source_ref='request:<id>', expense_request_id=req.id) e seta `requests.status='aprovada'+cashflow_entry_id`.

Tabelas novas: `expense_policies` (transparência: max_value, requires_attachment) e `request_slas` (UNIQUE org+module+subtype+priority). RLS: SELECT a todos membros, modificação só admin/financeiro/master.
