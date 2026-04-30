---
name: Realtime Sync & Optimistic Updates
description: useRealtimeSync hook centralizes Supabase Realtime subscriptions; useOptimisticUpdates provides safe optimistic mutation helpers
type: feature
---

## Tabelas em realtime (publicação `supabase_realtime`)

| Tabela                  | REPLICA IDENTITY | Adicionada na fase |
| ----------------------- | ---------------- | ------------------ |
| `notifications`         | (default)        | pré-existente      |
| `hr_*` (9box, BSC, PDI) | (default)        | pré-existente      |
| `cashflow_entries`      | FULL             | Phase 4            |
| `contracts`             | FULL             | Phase 4            |
| `contract_installments` | FULL             | Phase 4            |
| `request_tasks`         | FULL             | Phase 4            |

`REPLICA IDENTITY FULL` faz UPDATE/DELETE entregarem a linha completa — necessário para optimistic merge no cliente.

## Hooks

### `useRealtimeSync(subs)` — `src/hooks/useRealtimeSync.ts`
Subscreve uma ou mais tabelas e invalida queries do React Query quando eventos chegam.
- Filtra automaticamente por `organization_id=eq.<currentOrg>` (override com `scopeToOrg: false` ou `filter` custom).
- Canal único por (tabela + filter); cleanup completo no unmount.
- Não faz throttle — React Query já coalesce invalidations da mesma key.

### `useOptimisticUpdates()` — `src/hooks/useOptimisticUpdates.ts`
Helpers para `useMutation`:
- `optimisticUpdate(key, updater)` — cancela queries em voo, snapshot anterior, aplica updater.
- `optimisticInsert(key, item)` — prepend.
- `optimisticDelete(key, id)` — remove por id.
- `rollback(context)` — restaura snapshot em `onError`.

## Padrão recomendado em mutations
```ts
const opt = useOptimisticUpdates();
useMutation({
  mutationFn: api.update,
  onMutate: (next) => opt.optimisticUpdate<Entry>(["cashflow", orgId], (rows) =>
    rows?.map((r) => r.id === next.id ? { ...r, ...next } : r)
  ),
  onError: (_e, _v, ctx) => opt.rollback(ctx),
  onSettled: () => qc.invalidateQueries({ queryKey: ["cashflow", orgId] }),
});
```

## Onde já está plugado
- `src/pages/Dashboard.tsx` — assina `cashflow_entries`, `contracts`, `contract_installments` e invalida `cashflow`, `cashflow-summary`, `dashboard-kpis`, `contracts`, `contract-installments`.

## Como expandir
Adicionar novas tabelas à lista `subs` em qualquer página viva. Para tabelas usadas em múltiplas páginas (ex.: `notifications`), preferir um único `useRealtimeSync` no layout raiz.

## Segurança
RLS é enforced pelo Supabase Realtime — usuários só recebem eventos de linhas que já podem `SELECT`.
