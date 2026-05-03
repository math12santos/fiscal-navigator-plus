---
name: Dashboard Snapshot Cache
description: Cache jsonb compartilhado por org+mês com invalidação instantânea via trigger e warmup cron 3h
type: feature
---

## Padrão

1. **`org_data_version`** — contador `bigint` por org. Triggers `AFTER INSERT/UPDATE/DELETE` em
   `cashflow_entries`, `contracts`, `contract_installments`, `liabilities`, `crm_opportunities`,
   `payroll_items`, `payroll_runs` chamam `bump_org_data_version()` (1 UPSERT, ~µs).
2. **`dashboard_snapshots(org, reference_month)`** — guarda `payload jsonb`, `data_version`,
   `computed_at`, `stale_at = computed_at + 3h`. RLS SELECT para membros + BPO.
3. **`get_dashboard_snapshot(org, ref_month, force=false)`** — RPC SECURITY DEFINER. Retorna
   cache se `stale_at > now()` E `snapshot.data_version >= org_data_version.version`. Senão
   recomputa via `recompute_dashboard_snapshot`.
4. **Edge function `dashboard-snapshot-warmer`** + cron `dashboard-snapshot-warmer-3h` (`0 */3 * * *`)
   percorre `list_orgs_for_snapshot_warmup()` (orgs ativas nos últimos 30d).

## Frontend

- Hook `useDashboardSnapshot(referenceMonth)` em `src/hooks/useDashboardSnapshot.ts`.
- `staleTime = gcTime - 1h` alinhado ao TTL do snapshot; `refetchOnWindowFocus=false`.
- `useRealtimeSync` no `Dashboard.tsx` invalida `["dashboard-snapshot"]` em mudanças locais
  (tabelas: cashflow_entries, contracts, contract_installments, liabilities, crm_opportunities).
- Header mostra `Atualizado HH:mm` + botão de refresh manual (`force=true`).

## Como adicionar nova tabela ao tracking

```sql
DROP TRIGGER IF EXISTS trg_bump_org_version ON public.<tabela>;
CREATE TRIGGER trg_bump_org_version
  AFTER INSERT OR UPDATE OR DELETE ON public.<tabela>
  FOR EACH ROW EXECUTE FUNCTION public.bump_org_data_version();
```
E listar a chave React Query correspondente em `useRealtimeSync` do consumidor.

## Reuso futuro

Mesmo padrão pode envelopar `BackofficeDashboard` (saas-kpis), Planejamento e Financeiro:
basta criar uma função `recompute_*_snapshot` análoga e reaproveitar `org_data_version`.
