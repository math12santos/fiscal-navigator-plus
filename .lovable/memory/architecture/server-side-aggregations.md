---
name: Server-Side Aggregation RPCs
description: Postgres RPCs that aggregate Dashboard KPIs and Cashflow summary in 1 round-trip — SECURITY INVOKER respeitando RLS
type: feature
---

## RPCs disponíveis (Phase 3 Performance)

### `get_dashboard_kpis(_organization_id uuid) → jsonb`
Retorna `{ contracts: { active_count, monthly_value }, liabilities: { total, judiciais, contingencias_provaveis, judicial_count }, crm: { weighted_value, open_count, stale_count } }`.
- Substitui 3 reduções pesadas no cliente.
- `monthly_value` já normaliza recorrência (mensal/bimestral/trimestral/semestral/anual).
- `weighted_value` usa `estimated_value × stage.probability/100` apenas em opportunities abertas.
- `stale_count` = abertas com `updated_at < now() - 30d`.

### `get_cashflow_summary_by_period(_organization_id, _from date, _to date) → jsonb`
Retorna `{ totals: {entradas,saidas,saldo,count}, monthly: [{month,entradas,saidas,saldo}], by_category: [{tipo,categoria,total,count}] }`.
- `monthly` sempre tem 1 linha por mês do range (zera buckets vazios via `generate_series`).
- Usa `COALESCE(valor_realizado, valor_previsto)`.

## Hooks consumidores
- `useDashboardKPIs()` — `cachePresets.operational` + `keepPreviousData`.
- `useCashflowSummary(rangeFrom, rangeTo)` — idem.
- Ambos passam `organization_id` automaticamente via `useOrganization()`.

## Segurança
Ambas as RPCs são `SECURITY INVOKER` — RLS de `cashflow_entries`, `contracts`, `liabilities`, `crm_opportunities`, `crm_pipeline_stages` é aplicada transparente. Não criar versão `SECURITY DEFINER` sem revisar com cuidado.

## Limitação atual / TODO Fase 3.5
RPCs ignoram filtros operacionais (cost_center_id, subsidiary). `useFinancialSummary` segue como fonte para Dashboard/RelatorioKpi/Planning enquanto novos componentes podem adotar as RPCs diretamente. Ao expandir, adicionar parâmetros opcionais `_cost_center_ids uuid[]` nas RPCs.

## Índices de suporte
`idx_cashflow_org_dataprev`, `idx_contracts_org_status`, `idx_liabilities_org_status`, `idx_crm_opps_org_open` (partial WHERE won_at IS NULL AND lost_at IS NULL).
