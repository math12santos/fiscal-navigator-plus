---
name: Performance Optimization
description: React.lazy+Suspense, lazyRetry, useMemo charts, React Query global cache defaults, hover-prefetch sidebar, single Suspense per shell
type: preference
---

## Padrões de performance estabelecidos

### Code splitting & chunks
- Páginas grandes carregadas com `React.lazy` + `Suspense`.
- `lazyRetry` recarrega o chunk após deploy se a versão antiga sumiu (sessionStorage flag).
- **Prefetch no hover** (`AppLayout`): cada link da sidebar dispara o factory do chunk em `onMouseEnter`/`onFocus` via `pageFactories` exportado de `App.tsx`. Set `prefetched` evita repetição. Resultado: ao clicar, o chunk já está em cache.

### Suspense topology
- **Apenas dois níveis** dentro de `ProtectedRoutes`/`BackofficeRoutes`:
  1. Externo (carrega o `AppLayout`/`BackofficeLayout`) → fallback `FullScreenLoader`.
  2. Interno (envolve `<Routes>`) → fallback `ContentSkeleton` leve.
- **Não usar Suspense aninhado por rota** — sidebar/header devem permanecer montados durante navegação. Apenas a área central faz "blink".

### React Query defaults globais (`App.tsx`)
```ts
new QueryClient({ defaultOptions: { queries: {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  retry: 1,
}}})
```
Permissões/módulos (raramente mudam por sessão) usam `staleTime: 5 * 60_000`:
- `useUserPermissions` (todas as 4 sub-queries)
- `useCostCenterPermissions` + `useCostCenterPermissionsBulk`
- `useOrgModules`
- `useSystemModules`

### Cache key stability
- `useCostCenterPermissionsBulk` recebe arrays que podem reordenar entre renders. **Sempre memoizar** com `useMemo` (dedup + sort) antes de virar `queryKey`. Mutar/ordernar in-place o array de entrada quebra o cache.

### ModuleMaintenanceGuard
- Durante `isLoading`, **renderiza children** (não retorna `null`). A página tem seu próprio skeleton; bloquear o guard durante loading provoca double-flash com o Suspense.
- Só interrompe quando confirma `!systemEnabled` ou `!orgEnabled`.

### Charts
- Memos de dados com `useMemo` por dependências explícitas (filtros, períodos).
- Evitar re-render de Recharts em cascata: estabilizar `data` por referência.
