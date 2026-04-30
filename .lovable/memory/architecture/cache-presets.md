---
name: cache-presets-architecture
description: React Query cache tiering via cachePresets (reference/operational/realtime/static)
type: feature
---

`src/lib/cachePresets.ts` define 4 tiers de cache para uso com React Query:

- **reference** (15 min stale, 60 min gc): cadastros estruturais — chart_of_accounts, cost_centers, entities, products, departments, payment_methods, bank_accounts, fiscal_groups
- **operational** (2 min stale, 30 min gc): dados de trabalho diário — cashflow, contratos, tarefas, requests
- **realtime** (10s stale): notificações, etl jobs
- **static** (60 min stale): organizações do usuário, roles globais, configs do sistema

Default global do QueryClient (App.tsx) = perfil "operational" (5min/30min).

Uso:
```ts
useQuery({ queryKey, queryFn, ...cachePresets.reference })
```

OrganizationContext e useCurrentRole foram migrados para React Query com tier `static`, eliminando 3 fetches duplicados de `user_roles` (AuthRoute + BackofficeRoutes + ad-hoc).

useCurrentRole substitui pattern antigo de `useState + useEffect + supabase.from("user_roles")` espalhado pelo App.tsx.
