## Plano de Performance & Cache — FinCore

**Status: Fases 1 e 2 concluídas.** Próximo: Fase 3 (RPCs Postgres de agregação para Dashboard/Financeiro).

### Fase 2 entregue
- `src/lib/routePrefetch.ts`: prefetchers de queries primárias por rota (dashboard, financeiro, contratos, dp, crm, cadastros, tarefas) com dedup por (rota × org).
- `AppLayout` agora dispara `prefetchRouteQueries` no `onMouseEnter`/`onFocus` da sidebar, junto com o prefetch de chunk já existente.
- `placeholderData: keepPreviousData` em `useCashFlow` (entries + installments) e `useGroupTotals`: trocar mês/range não pisca skeleton, mantém os dados anteriores enquanto o novo carrega.
- Em RQ v5, isso também faz `isLoading` ficar `false` durante refetches — sem necessidade de trocar para `isInitialLoading` nos consumidores.

### Fase 1 entregue
- `src/lib/cachePresets.ts`: 4 tiers (reference 15min / operational 2min / realtime 10s / static 60min).
- `QueryClient` default elevado de 60s para 5min stale (App.tsx).
- `OrganizationContext` migrado para React Query (queryKey `organizationsBundle`, tier static).
- `useCurrentRole` (novo): cache global compartilhado por AuthRoute + BackofficeRoutes (eliminou 2 fetches duplicados de `user_roles` por navegação).
- `cachePresets.reference` aplicado em: useCostCenters, useChartOfAccounts, useEntities, useProducts, useDepartments, usePaymentMethods, useBankAccounts, useFiscalGroups.

### Diagnóstico (o que encontrei)

Mapeei `App.tsx`, contextos globais, 98 hooks (78 já usam React Query — bom) e as páginas mais pesadas (Dashboard 597 linhas / 25 hooks, Contratos 690, Financeiro consolida cashflow + contratos + projeções de folha).

Pontos que causam a sensação de "tela carregando o tempo todo":

1. `**staleTime: 60s**` global (App.tsx:101). Toda navegação entre módulos refaz dezenas de queries que mudaram pouco (cost centers, chart of accounts, entidades, posições). Para uma cockpit financeira, dados estruturais (cadastros, configs) podem ficar **10–15 min** em cache, e fatos (cashflow) **5–10 min** com revalidação inteligente.
2. `**OrganizationContext` não usa React Query** — refaz a busca de orgs a cada montagem do provider e não compartilha cache. Mesma coisa em `AuthRoute`, `BackofficeRoutes` e `useNeedsOnboarding` (3 queries `user_roles` independentes a cada navegação).
3. `**select("*")` em 101 lugares**, incluindo `cashflow_entries` (tabela maior do sistema). Trazemos colunas grandes (`metadata jsonb`, `notes`, etc.) que o front não usa em listas.
4. **Cascata de queries dependentes** em `useCashFlow`/`useFinanceiro`: 1) busca contratos → 2) calcula `nonRecurringContractIds` → 3) busca installments → 4) busca payroll projections → 5) recalcula projeções no cliente. Cada passo é um round-trip serial.
5. **Sem prefetch** entre rotas. O `lazyRetry` faz code-split (bom), mas o usuário só vê o skeleton porque a query inicial só dispara **depois** que o componente monta. Já temos a infra (`pageFactories`) para prefetch on-hover, mas as **queries** não são pré-aquecidas.
6. **Projeções financeiras recalculadas a cada render** com inputs grandes (todos os contratos × todo o range). `useMemo` existe, mas a chave inclui arrays inteiros — qualquer refetch invalida tudo.
7. **Sem agregação no banco**: KPIs do Dashboard (saldo, contas a pagar, runway) somam no cliente arrays grandes vindos de `select *`. Deveriam ser RPCs (`get_dashboard_kpis(org_id, ref_month)`) que retornam números prontos e podem ser cacheados agressivamente.
8. **Sem Realtime cirúrgico**: hoje, mutations invalidam queries inteiras. Outro usuário fazendo lançamento não atualiza a tela do colega — usuários acabam apertando F5 (e culpam a "lentidão").

---

### Fase 1 — Quick wins (impacto alto, baixo risco)

**1.1 Tunar defaults do `QueryClient**` com classes de cache por tipo de dado:

- `staleTime: 5min`, `gcTime: 30min` como novo default.
- Helper `cachePresets` em `src/lib/cachePresets.ts`:
  - `reference` (cadastros, COA, cost centers, posições): `staleTime: 15min`
  - `operational` (cashflow, contratos, tarefas): `staleTime: 2min`
  - `realtime` (notificações, ETL ops): `staleTime: 10s`
  - `static` (configs do sistema, módulos): `staleTime: 60min`
- Aplicar nos hooks principais via spread: `useQuery({ ...cachePresets.reference, queryKey, queryFn })`.

**1.2 Migrar `OrganizationContext` para React Query** — chave global `["organizations", userId]` compartilhada com `useNeedsOnboarding`, `AuthRoute`, `BackofficeRoutes` (elimina 3 fetches duplicados de `user_roles`).

**1.3 Substituir `select("*")` por listas explícitas** nas 5 tabelas mais "gordas":

- `cashflow_entries` (omit `metadata`, `notes` em listas)
- `contracts` (omit `terms`, `attachments_meta`)
- `payroll_items`, `employees`, `dp_config`
- Criar `select` específico por uso (lista vs detalhe). Estimativa: −40% no payload das telas.

**1.4 Deduplicar queries em providers globais**: `AuthContext` já tem user; criar `useCurrentRole()` único (cache global) consumido por `AuthRoute`, `BackofficeRoutes`, navegação.

---

### Fase 2 — Prefetch e percepção de fluidez

**2.1 Prefetch de query on-hover** — `AppLayout` já tem prefetch de chunk via `pageFactories`. Adicionar prefetch das **queries primárias** de cada rota:

```ts
onMouseEnter={() => {
  pageFactories.financeiro();
  queryClient.prefetchQuery({ queryKey: ["cashflow_entries", orgId, ...], queryFn: ... });
}}
```

Mapa de queries críticas por rota em `src/lib/routePrefetch.ts`.

**2.2 `placeholderData: keepPreviousData**` em queries paginadas/com filtros (Financeiro por mês, KPIs por período). Trocar de mês/filtro deixa de mostrar skeleton — usa o anterior enquanto carrega o novo.

**2.3 Skeletons mais leves** — manter os atuais mas garantir que `Suspense` só engatilha em mudança de **rota**, não em refetch. Substituir `if (loading) return <Skeleton/>` por `isInitialLoading` (não dispara em refetch em background).

**2.4 LCP estático já aplicado** (`mem://architecture/lcp-static-skeleton`). Estender para Dashboard com placeholder de KPIs sem JS.

---

### Fase 3 — Agregação no servidor (matar over-fetch estrutural)

Mover cálculos do cliente para RPCs Postgres com `STABLE` + cache via React Query:

**3.1 `get_dashboard_kpis(p_org_id uuid, p_ref_month date)**` retorna saldo, runway, AP/AR, margem operacional já agregados. Hoje o Dashboard busca cashflow inteiro e soma no cliente.

**3.2 `get_cashflow_summary_by_period(...)**` com agregação por mês/categoria/grupo — substitui várias chamadas em `useGroupTotals`/`useFinancialSummary`.

**3.3 `get_contract_projections(p_org_id, p_from, p_to)**` consolida contratos recorrentes + parcelas + projeções de folha em **uma view materializável**. Elimina a cascata cliente de `useCashFlow` (4 round-trips → 1).

**3.4 Índices auxiliares** em `cashflow_entries (organization_id, data_prevista)`, `contract_installments (contract_id, data_vencimento)`, `payroll_items (run_id)` se não existirem.

**3.5 Materialized view opcional** `mv_dashboard_daily` refrescada por trigger nas tabelas-fonte (apenas se a Fase 3.1 não bastar).

---

### Fase 4 — Realtime cirúrgico e colaboração multi-usuário

Resolve o "outro usuário lançou e eu não vejo":

**4.1 Canal Realtime por organização**: `supabase.channel('org:'+orgId).on('postgres_changes', { table: 'cashflow_entries', filter: 'organization_id=eq.'+orgId }, ...)`.

- Em vez de invalidar a query inteira, **patchar** o cache do React Query (`queryClient.setQueryData`) com o registro alterado.
- Hook utilitário `useRealtimeSync(table, queryKeyBuilder)`.

**4.2 Tabelas com realtime** (priorizadas): `cashflow_entries`, `tasks`, `notifications`, `contracts`, `etl_jobs`. Habilitar via `ALTER PUBLICATION supabase_realtime ADD TABLE ...`.

**4.3 Indicador de "atualizado agora"** discreto no header — reforça percepção de sistema vivo.

**4.4 Otimistic updates** em mutations frequentes (criar tarefa, marcar lançamento como pago). Hoje o usuário vê spinner — passa a ver a mudança imediata + rollback se falhar.

---

### Métricas de sucesso


| Métrica                                   | Hoje (estimado) | Meta                         |
| ----------------------------------------- | --------------- | ---------------------------- |
| Tempo até KPIs do Dashboard visíveis      | 2–4s            | <800ms (cache quente <100ms) |
| Round-trips na carga do Financeiro        | 8–12            | 2–3                          |
| Payload médio `cashflow_entries` (lista)  | ~3KB/linha      | <800B/linha                  |
| Refetches por navegação (3 trocas de aba) | 30–50           | <10                          |
| Queries duplicadas (org/role) por carga   | 4–6             | 1                            |


Faremos um benchmark com `browser--performance_profile` antes da Fase 1 e ao fim de cada fase.

---

### Sequência sugerida

1. **Fase 1** primeiro (1 sessão) — usuário já sente diferença no mesmo dia.
2. **Fase 2** logo em seguida (1 sessão) — fluidez de navegação.
3. **Fase 3** (1–2 sessões) — exige migration SQL + ajuste dos hooks de Dashboard/Financeiro.
4. **Fase 4** (1 sessão) — depende de Realtime estar habilitado nas tabelas certas.

Posso executar uma fase de cada vez. Diga **"executar fase 1 de performance"** para começar pelos quick wins, ou peça reordenação (por exemplo, priorizar Realtime primeiro se o problema multi-usuário for o mais urgente).
---

## ✅ Fase 3 (Performance) — Agregações no servidor (concluída)

**Migration:** `20260430231844` — RPCs Postgres + índices.

### RPCs criadas (SECURITY INVOKER, respeitam RLS existente)
1. **`get_cashflow_summary_by_period(_organization_id, _from, _to)`** → JSON `{ totals, monthly[], by_category[] }`. Substitui 3 reduções no cliente (totais, gráfico mensal, breakdown por categoria) por 1 round-trip.
2. **`get_dashboard_kpis(_organization_id)`** → JSON `{ contracts, liabilities, crm }`. Calcula contratos ativos, valor mensal normalizado, passivos agregados, CRM weighted_value/open/stale em 1 RPC.

### Índices de suporte (idempotentes)
- `idx_cashflow_org_dataprev` em `cashflow_entries(organization_id, data_prevista)`
- `idx_contracts_org_status`, `idx_liabilities_org_status`
- `idx_crm_opps_org_open` (parcial: `won_at IS NULL AND lost_at IS NULL`)

### Hooks novos (prontos para consumo)
- `useDashboardKPIs()` em `src/hooks/useDashboardKPIs.ts` — preset `operational`, `keepPreviousData`.
- `useCashflowSummary(rangeFrom, rangeTo)` em `src/hooks/useCashflowSummary.ts` — preset `operational`, `keepPreviousData`.

### Por que não troquei os consumidores ainda
`useFinancialSummary` é importado por `Dashboard`, `RelatorioKpi`, `usePlanningPdfReport`, `PlanningCockpit` e `useCashFlow`. Ele aplica filtros operacionais (cost_center, subsidiary) sobre o array de entries. Substituir por RPC exige que as RPCs aceitem esses mesmos filtros — escopo de uma **Fase 3.5** dedicada (assinaturas das RPCs já estão preparadas para isso).

**Como adotar gradualmente:** novos componentes de Dashboard (KPI cards, gráficos summary) devem usar `useDashboardKPIs`/`useCashflowSummary` direto; consumidores antigos migram quando passarem por refactor.

### Próximo passo sugerido
- **Fase 4 — Realtime**: habilitar canais Supabase em `cashflow_entries`, `contracts`, `notifications` para sincronização multi-usuário e *optimistic updates* via `useMutation`.

---

## ✅ Fase 4 (Performance) — Realtime + Optimistic updates (concluída)

**Migration:** `20260430232200` — `REPLICA IDENTITY FULL` + adição à publicação `supabase_realtime`.

### Tabelas habilitadas em realtime
- `cashflow_entries`, `contracts`, `contract_installments`, `request_tasks` (somam-se às já existentes: `notifications`, `hr_*`).

### Hooks novos
- **`useRealtimeSync(subs)`** — assina N tabelas, filtra por `organization_id` automaticamente, invalida React Query keys quando eventos chegam, cleanup no unmount.
- **`useOptimisticUpdates()`** — wrappers para `useMutation`: `optimisticUpdate/Insert/Delete` + `rollback`.

### Plugado no Dashboard
`src/pages/Dashboard.tsx` agora assina `cashflow_entries`, `contracts`, `contract_installments` e invalida automaticamente `cashflow`, `cashflow-summary`, `dashboard-kpis`, `contracts`, `contract-installments`. Quando outro usuário mutaciona qualquer dessas tabelas, o Dashboard atualiza em background — sem flash visual graças ao `keepPreviousData` da Fase 2.

### Como adotar em outros módulos
```ts
useRealtimeSync([
  { table: "cashflow_entries", invalidateKeys: [["cashflow"], ["dashboard-kpis"]] },
]);
```

### Segurança
`SECURITY INVOKER` nas RPCs (Fase 3) e RLS nativa do Supabase Realtime garantem que cada usuário só recebe eventos das linhas que já pode ler.

---

## 🎯 Roadmap de Performance — concluído

| Fase   | Status | Entrega principal                                                            |
| ------ | ------ | ---------------------------------------------------------------------------- |
| Fase 1 | ✅      | `cachePresets` (4 tiers) + dedup `OrganizationContext`/`useCurrentRole`     |
| Fase 2 | ✅      | Prefetch on-hover + `keepPreviousData` em filtros                            |
| Fase 3 | ✅      | RPCs `get_dashboard_kpis` / `get_cashflow_summary_by_period` + índices       |
| Fase 4 | ✅      | Realtime em `cashflow_entries`/`contracts`/`request_tasks` + optimistic API |

### Próximos passos opcionais (Fase 3.5 — backlog)
1. Estender RPCs com filtros operacionais (`_cost_center_ids uuid[]`).
2. Migrar `Dashboard`, `RelatorioKpi`, `PlanningCockpit` para consumir `useDashboardKPIs`/`useCashflowSummary`.
3. Aplicar `useOptimisticUpdates` em mutations críticas (criar/editar entrada, status de contrato).
4. Realtime em `request_tasks` e `notifications` plugados em layout raiz para badges globais.
