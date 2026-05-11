---
name: Compras MECE & Workflow Integration
description: Onda A (NF-e/MECE/retenções) + Onda B (tarefas automáticas, pending_wizard TI, divergência fecha tarefa)
type: feature
---

## Onda A — Integridade financeira
- NF-e completa em `purchase_receipts` (`nf_chave`, `nf_cnpj`, `nf_valor`); `validate_nfe_chave` (DV mod11).
- `compute_purchase_tax_retentions` (IRRF/INSS/ISS/PIS/COFINS/CSLL) para serviço/manutenção/obra.
- `cost_center_allocations` + `tax_retentions` (jsonb) em `purchase_orders` e `cashflow_entries`, validados 100%.
- `trg_pr_materialize_cashflow` re-tipa entry provisório para `a_pagar` na NF; idempotente por `source_ref='purchase_order:<id>'`.
- `purchase_order_to_cashflow` ignora pedidos com `contract_id` (parcela do contrato é fonte da verdade — MECE).
- `trg_po_check_fiscal_period` bloqueia confirmação em competência fechada.

## Onda B — Workflow operacional
- Helper `fn_compras_ensure_workflow_task(...)` cria 1 `requests` + 1 `request_tasks`, idempotente por `(reference_module, reference_id)`.
- `trg_po_create_receipt_task` em `purchase_orders` (status confirmado/enviado_ap) → tarefa "Confirmar recebimento".
- `trg_divergence_task_sync` em `purchase_divergences`:
  - aberta → cria tarefa "Resolver divergência (<tipo>)".
  - resolvida → marca tarefa relacionada como `concluida`.
- `it_equipment.pending_wizard` (bool). `trg_it_equipment_wizard_flag` (BEFORE) seta true para equipamentos com `invoice_number LIKE 'PO:%'`. `trg_it_equipment_wizard_task` (AFTER) cria tarefa "Completar cadastro TI".
- Reference modules: `compras_recebimento`, `compras_divergencia`, `ti_wizard_pendente`.
- Frontend: `useRealtimeSync` em `/compras` (orders/receipts/divergences/quotations/requests). Card "Tarefas pendentes" no `ComprasDashboard` (count via `requests` filtrado por reference_module).
