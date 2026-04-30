---
name: Cross-Module Integration Phase 1
description: Integrações cross-módulo (CRM Won → contrato, TI → cashflow CAPEX/sinistros, Jurídico → cashflow) materializadas via triggers e RPCs idempotentes
type: feature
---

## Padrão MECE de Materialização Cross-Módulo

Todas as integrações usam `cashflow_entries.source` + `source_ref` único por organização (índice único parcial: `(organization_id, source, source_ref) WHERE source_ref IS NOT NULL`).

### CRM → Contrato
- RPC `crm_generate_contract_from_opportunity(p_opportunity_id)` chamado em `useCRM.moveToStage` quando o estágio destino tem `won_at`.
- Cria contrato em rascunho com `source='crm'` e atualiza `crm_opportunities.contract_id`.
- Idempotente: retorna contract_id existente se já houver.

### TI → Cashflow (triggers automáticas)
- **Aquisição**: trigger `trg_it_equipment_cashflow` em `it_equipment` com `source='ti'`, `source_ref='equipment:<id>'`, categoria `capex_ti`.
- **Sinistro**: trigger `trg_it_incident_cashflow` em `it_incidents` (perda líquida = `estimated_loss_value - recovered_value`), `source_ref='incident:<id>'`, categoria `sinistro_ti`.
- Ambos propagam `cost_center_id` para rateio em DRE.
- DELETE automático se valor zerar.

### Jurídico → Cashflow (RPCs já existentes)
- `juridico_approve_settlement` materializa parcelas com `source='juridico'`, `source_ref='settlement:<id>:<n>'`.
- `juridico_post_expense_to_cashflow` posta despesa com `source_ref='expense:<id>'`.
- Helpers `juridico_settlement_cashflow_status` e `juridico_expense_is_posted` para badges UI.

### Hooks: invalidação obrigatória
Toda mutação em it_equipment/it_incidents/crm_opportunities deve invalidar `["cashflow"]` e `["financeiro"]` para refletir os triggers.
