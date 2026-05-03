## Cache compartilhado de Dashboard

### Como funciona

```text
Usuário lança/edita dado
        │
        ▼
Trigger AFTER INSERT/UPDATE/DELETE
        │  (cashflow_entries, contracts, contract_installments,
        │   liabilities, crm_opportunities, payroll_items, payroll_runs)
        ▼
org_data_version.version += 1   ← marcador "houve mudança"
        │
        ▼
Próxima leitura do Dashboard (qualquer usuário da org)
        │
        ▼
get_dashboard_snapshot(org, mês)
   ├─ Se snapshot.data_version >= versão atual E stale_at > now()
   │     → devolve cache em ~50ms  (cache_hit=true)
   └─ Senão recomputa síncrono e grava (cache_hit=false)

Cron a cada 3h:
   edge function dashboard-snapshot-warmer percorre orgs ativas
   e chama recompute_dashboard_snapshot — primeiro usuário do dia
   nunca paga o custo.
```

**Resultado prático:**
- Sem mudança nas últimas N horas → snapshot quente, abre instantâneo.
- Logo após alguém lançar dado → próxima abertura recomputa uma vez (~500ms) e os outros usuários da empresa já leem o cache fresco.
- Usuário sempre vê o número certo; nunca um número antigo.

---

### Entregáveis

#### 1. Migration `dashboard_snapshot_cache.sql`

Cria:
- **`org_data_version (organization_id, version, updated_at)`** — contador monotônico por org.
- **`dashboard_snapshots (organization_id, reference_month, payload jsonb, data_version, computed_at, stale_at)`** com PK composta. RLS: SELECT para membros da org e BackOffice.
- **Função `bump_org_data_version()`** + triggers `AFTER INSERT/UPDATE/DELETE` em: `cashflow_entries`, `contracts`, `contract_installments`, `liabilities`, `crm_opportunities`, `payroll_items`, `payroll_runs`. Cada mutação faz 1 UPSERT no contador da org (custo ~µs).
- **`recompute_dashboard_snapshot(org, ref_month) → jsonb`** SECURITY DEFINER. Chama as RPCs já existentes `get_dashboard_kpis` e `get_cashflow_summary_by_period`, agrega current/previous month, expense_by_category e avg_payroll, faz UPSERT no snapshot com `stale_at = now() + 3h` e `data_version = versão atual da org`.
- **`get_dashboard_snapshot(org, ref_month, force boolean default false) → jsonb`** SECURITY DEFINER. Valida acesso (`is_org_member` ou `has_backoffice_org_access`); se `stale_at > now()` E `snapshot.data_version >= org_data_version.version` → retorna cache; senão chama `recompute_dashboard_snapshot`. Retorno: `{ payload, computed_at, data_version, cache_hit }`.
- **`list_orgs_for_snapshot_warmup() → table(org, ref_month)`** — orgs com mutação nos últimos 30 dias.

#### 2. Edge function `dashboard-snapshot-warmer`

`supabase/functions/dashboard-snapshot-warmer/index.ts`:
- Service role client.
- Lista orgs via `list_orgs_for_snapshot_warmup`.
- Para cada uma, chama `recompute_dashboard_snapshot`.
- Loga total processado.

Agendamento via `pg_cron` a cada 3h (insert via tool, contém URL/anon key específicos do projeto).

#### 3. Hook + UI

**`src/hooks/useDashboardSnapshot.ts`** (novo):
```ts
useQuery({
  queryKey: ["dashboard-snapshot", orgId, refMonthIso],
  queryFn: () => supabase.rpc("get_dashboard_snapshot", {
    _organization_id: orgId,
    _reference_month: refMonthIso,
  }),
  staleTime: 3 * 60 * 60_000,   // RQ alinhado com TTL do snapshot
  gcTime: 4 * 60 * 60_000,
  placeholderData: keepPreviousData,
});
```
Retorna `{ payload, isLoading, isFetching, computedAt, cacheHit, refresh }`. `refresh()` chama com `_force=true` e invalida a query.

**`Dashboard.tsx`** — refator focado:
- Substitui `useFinancialSummary(rangeFrom, rangeTo)` pelo `useDashboardSnapshot(referenceMonth)` para tudo que vira KPI/gráfico (current/previous month, expense_by_category, contracts/liabilities/crm/payroll). 
- O `useRealtimeSync` já existente continua chamando `qc.invalidateQueries(["dashboard-snapshot"])` em mudanças locais → invalidação instantânea no navegador (complementa a invalidação por DB version).
- Mantém `useCashFlow`/`useContracts` apenas se preciso para listas detalhadas — Dashboard não usa.
- Adiciona no header pequeno indicador: `Atualizado HH:mm` + botão `Atualizar agora` (chama `refresh()`).
- `useFinancialSummary` permanece para `Planejamento`/`Cockpit` que usam `entries` brutos.

#### 4. Memória de arquitetura

`mem://architecture/dashboard-snapshot-cache` documentando:
- Padrão (org_data_version + snapshot + warmer);
- Tabelas trackeadas e como adicionar novas;
- TTL 3h e por que (balance entre custo de recompute e frescor "cega");
- Como reusar para `BackofficeDashboard` (saas-kpis), `Financeiro/dashboard` e `Planejamento/cockpit` em fases futuras.

---

### Notas técnicas

- `bump_org_data_version` usa `SECURITY DEFINER` + `SET search_path = public` (boas práticas Lovable).
- Snapshot é `SECURITY DEFINER` mas com check explícito `is_org_member OR has_backoffice_org_access` no read — equivalente a RLS, sem o overhead de re-aplicar RLS em cada subquery do recompute.
- Triggers são leves (1 UPSERT). Mesmo bulk imports só pagam isso por linha — aceitável; se virar gargalo, podemos converter para `AFTER STATEMENT`.
- `data_version` no snapshot resolve race condition: se uma escrita pingou o counter entre o snapshot e a leitura, a comparação `snapshot.data_version >= current_version` falha e força recompute.
- `keepPreviousData` no React Query mantém a tela populada enquanto recomputa — sem flicker.

### Fora de escopo (próxima onda, se aprovado)
Aplicar mesmo padrão a `BackofficeDashboard` (KPIs SaaS), `Planejamento` cockpit e `Financeiro` dashboard.

Aprovação para executar?
