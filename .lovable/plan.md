

## Diagnóstico e otimização da navegação entre módulos

A lentidão ao alternar entre módulos vem de **três fatores cumulativos** que descobri inspecionando o código:

### Causas-raiz identificadas

**1. Cada módulo refaz o mesmo trabalho do zero a cada navegação (efeito mais visível)**

`AppLayout` chama `useUserPermissions()` em cada render, e cada página **também** chama `useUserPermissions()` por dentro. Esse hook hoje dispara, em sequência:

- `user_permissions` (uma query)
- `is_master` (outra query)
- `is_backoffice` + `backoffice_organization_access` (até 2 queries)
- `user_cost_center_access_ids` (mais uma)
- `useCostCenterPermissionsBulk` que **muda a queryKey toda vez** porque ela inclui o array de CC ordenado como string — qualquer reordenação invalida o cache
- `useOrgModules` (mais uma)

Em `ModuleMaintenanceGuard`, há **mais** chamadas (`useSystemModules` + `useOrgModules`), também por página. Resultado: ~5-7 round-trips ao Supabase só para "ter direito a renderizar a tela", e o `Suspense` mostra o skeleton até tudo concluir.

**2. `QueryClient` sem defaults — cada query refetch ao foco da janela e tem `staleTime: 0`**

`new QueryClient()` em `App.tsx` está sem `defaultOptions`. Apenas algumas queries definem `staleTime` individual (30s/60s); o resto refaz a chamada toda vez que o componente monta ou a janela ganha foco. Cada navegação interna conta como "remontar" → refetch em massa.

**3. Páginas pesadas + `Suspense` por rota sem prefetch**

Páginas como `Planejamento` (901 linhas, ~30+ imports incluindo todos os filhos `PlanningCockpit/Budget/Scenarios/Operational`), `RelatorioKpi` (1234 linhas), `Contratos` (690), `Dashboard` (549) são chunks grandes carregados sob demanda. Cada `<Suspense>` aninhado por rota só desbloqueia depois que o chunk **e** as queries terminam.

**4. Tela em branco entre rotas**

`ModuleMaintenanceGuard` retorna `null` enquanto `systemLoading || orgLoading` — somado ao `Suspense` que mostra "Carregando…", o usuário vê **dois flashes** de carregamento por navegação.

### Plano de otimização

**A. Defaults globais do React Query (`src/App.tsx`)**

Configurar o `QueryClient` com defaults conservadores:
- `staleTime: 60_000` (dados ficam frescos por 1 min — evita refetch ao remontar)
- `gcTime: 5 * 60_000` (mantém em cache por 5 min)
- `refetchOnWindowFocus: false` (corta o refetch automático ao alternar abas/janelas)
- `refetchOnReconnect: true` (mantém)
- `retry: 1` (em vez do default 3, que faz a UI parecer travada em erro)

Impacto direto: navegar de Financeiro → Planejamento → Dashboard reaproveita permissões, módulos e dados do cache em vez de refazer queries.

**B. Centralizar o gate de permissões num só lugar (`src/components/AppLayout.tsx` + `ModuleMaintenanceGuard.tsx`)**

- Mover a checagem `canAccessModule` do `ModuleMaintenanceGuard` (ou consolidar para que `AppLayout` gere o gate uma vez e o guard só verifique manutenção).
- `useUserPermissions` já roda no `AppLayout`; o React Query reaproveita o cache desde que as `queryKey`s sejam estáveis. Vou:
  - Estabilizar a `queryKey` de `useCostCenterPermissionsBulk` usando o array já ordenado deduplicado e memorizado, para evitar miss de cache entre renders.
  - Garantir `staleTime: 5 * 60_000` nas queries de permissão/módulo (raramente mudam durante a sessão).
- `ModuleMaintenanceGuard` deixa de retornar `null` durante loading: enquanto carrega, **renderiza o `children`** (a página já tem seus próprios skeletons) e só interrompe se confirmar manutenção. Elimina o "flash branco extra".

**C. Remover o `Suspense` aninhado redundante (`src/App.tsx`)**

Hoje cada `<Route element={…}>` está envolto em `<Suspense fallback={…}>` **dentro de outro `Suspense`**. Mantenho um único `Suspense` no nível do `AppLayout` e removo os internos — assim, quando o usuário troca de rota, a sidebar e o cabeçalho permanecem montados e só a área de conteúdo mostra o fallback (que pode até ser `null` ou um skeleton leve).

**D. Pré-carregar chunks ao passar o mouse no menu (`src/components/AppLayout.tsx`)**

Adicionar `onMouseEnter` em cada `<Link>` da sidebar que chama o `factory()` correspondente do `lazyRetry` (ex.: `import("@/pages/Planejamento")`). Isso instrui o navegador a baixar o chunk **enquanto o usuário move o mouse para clicar** — quando ele clica, o chunk já está em cache e a navegação fica instantânea. Padrão simples, sem mudar a lógica das páginas.

**E. Skeleton estável no `LoadingFallback` (`src/App.tsx`)**

Trocar o "Carregando…" tela inteira por um skeleton leve que cabe **dentro** do `AppLayout` (sidebar + cabeçalho permanecem). Isso evita que toda a tela "pisque" entre rotas.

### Ordem de aplicação

1. `App.tsx`: defaults do `QueryClient` + `Suspense` único + `LoadingFallback` enxuto.
2. `useUserPermissions.ts` + `useCostCenterPermissions.ts`: estabilizar queryKey e subir `staleTime` para 5 min.
3. `useOrgModules.ts` e `useSystemModules.ts`: subir `staleTime` para 5 min.
4. `ModuleMaintenanceGuard.tsx`: não bloquear a renderização do `children` durante o `isLoading`; só interromper quando confirmar bloqueio.
5. `AppLayout.tsx`: prefetch dos chunks no `onMouseEnter` dos links da sidebar.

### Resultado esperado

- **Primeiro acesso**: ligeiramente igual (chunks ainda precisam baixar uma vez).
- **Trocas de módulo subsequentes**: praticamente instantâneas — sem refetch de permissões/módulos, sem flash branco, sidebar não desmonta.
- **Pré-aquecimento por hover**: chunks já em cache antes do clique → navegação imediata mesmo no segundo módulo.

### Arquivos a editar

- `src/App.tsx` (defaults do QueryClient, Suspense único, LoadingFallback).
- `src/hooks/useUserPermissions.ts` (staleTime + queryKey estável).
- `src/hooks/useCostCenterPermissions.ts` (queryKey estável).
- `src/hooks/useOrgModules.ts` (staleTime 5 min).
- `src/hooks/useSystemModules.ts` (staleTime 5 min).
- `src/components/ModuleMaintenanceGuard.tsx` (não bloquear durante loading).
- `src/components/AppLayout.tsx` (prefetch no hover).

Sem mudanças de schema, sem mudanças de lógica de negócio, sem alterar o comportamento dos módulos individuais — apenas configuração de cache, ordem de renderização e prefetch.

