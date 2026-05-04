---
name: Expense Requests + Interdept Tickets Multi-Module
description: Botão "Abrir Chamado" em DP/Jurídico/TI/CRM/Financeiro/Cadastros com 3 abas (Despesa/Reembolso/Chamado). Despesa+Reembolso vão para Financeiro (provisionam cashflow). Chamado é interdepartamental (type='interdepartmental') e ficará no futuro módulo PMO/Operações.
type: feature
---

`RequestExpenseButton` (sourceModule prop) — label do botão é **"Abrir Chamado"**. Dialog com 3 tabs:
- **Despesa** → `requests.type='expense_request'`, descPayload `{subtype:'expense'}`, area_responsavel='financeiro'
- **Reembolso** → `requests.type='expense_request'`, descPayload `{subtype:'reimbursement', data_gasto, forma_pagamento_pessoal}`, area_responsavel='financeiro'
- **Chamado** → `requests.type='interdepartmental'`, descPayload `{subtype:'ticket', target_department_id, target_area, sla_due_date, source_module}`, area_responsavel = nome do dept destino (ou form.target_area). `data_vencimento` recebe `sla_due_date` para acompanhamento de SLA.

Aba Solicitações no Financeiro filtra por `type='expense_request'` — chamados NÃO aparecem ali (pertencerão ao módulo PMO/Operações). Departamentos vêm de `useDepartments()` (hr_departments).

Tabelas: `expense_policies` e `request_slas` aplicam só para subtype expense/reimbursement (no UI o subtype 'ticket' usa subtype='expense' nas queries de policies/slas mas não exibe o alert).

Auto-roteamento `area_responsavel` no chamado permite que módulos futuros filtrem por área para exibir filas operacionais.
