

## Carregamento incremental ao alternar Mensal/Trimestral

Tornar a alternância de granularidade **instantânea no card do Total e na reconciliação** e **incremental na composição** (tabela), exibindo skeletons por seção enquanto a reagregação trimestral (potencialmente custosa em horizontes longos) é calculada em segundo plano com `useTransition`.

### O que o usuário verá

1. Ao clicar em **Mensal** ou **Trimestral** no toggle ao lado do Total:
   - O **card do Total** (valor, contagem de itens, badge de reconciliação) **não pisca** — permanece estável e legível.
   - O **painel de Reconciliação** (validação cruzada com o Dashboard) **não pisca** — permanece estável.
   - O **toggle** mostra um indicador sutil de "atualizando" (spinner pequeno + opacity reduzida no item recém-clicado) enquanto a reagregação roda.
   - A **tabela de composição** mostra um **skeleton de linhas** (5–8 linhas com `Skeleton` do shadcn) preservando o cabeçalho, paginação e toolbar (busca/page size) durante a transição.

2. Em horizontes pequenos a transição é imperceptível; em horizontes grandes (ex.: 5 anos × milhares de lançamentos), o usuário vê o skeleton por algumas centenas de ms em vez de a UI travar inteira.

3. Nenhum comportamento muda além da percepção: total, reconciliação, busca, paginação e CSV continuam idênticos.

### Como funciona (técnico)

**A. `useTransition` para a granularidade**

Em `RelatorioKpi.tsx`:
- Manter `granularity` (derivado da URL) como hoje, mas adicionar estado **local** `pendingGranularity` controlado por `startTransition`.
- O cálculo de `aggregatedRows` (e `displayKind`, `pagedItems`) passa a depender de `deferredGranularity` (via `useDeferredValue` ou `pendingGranularity`).
- O `Total` (`rows.total` / `filteredTotal`) e o `reconciliation` **não** dependem de `granularity` — já são puros do `rows` mensal — portanto continuam síncronos e nunca entram em estado pendente.

**B. Skeleton por seção na tabela**

- Adicionar `isPending` retornado por `useTransition()`.
- Quando `isPending && supportsQuarterly`, no `<TableBody>` renderizamos `pageSize` linhas de `<Skeleton>` (cada `<TableCell>` com um `Skeleton className="h-4 w-full" />`) em vez de `pagedItems.map(...)`.
- Cabeçalho da tabela (`renderHeader(displayKind)`), toolbar (busca + itens por página) e rodapé de paginação **permanecem montados** — só o corpo recebe skeleton. Isso evita layout shift.

**C. Indicador no toggle**

- No `ToggleGroupItem` ativo durante `isPending`, exibir um pequeno `Loader2` animado à direita do label e aplicar `opacity-70`. Quando a transição termina, volta ao normal.
- O toggle continua clicável durante a transição; cliques sucessivos cancelam transições anteriores naturalmente (React 18 batch).

**D. Sincronização com a URL**

- A escrita do `?gran=` continua **síncrona** via `setSearchParams` (`replace: true`), preservando o link compartilhável.
- A reagregação fica dentro do `startTransition`, separando a "intenção" (já refletida na URL e no toggle visual) do trabalho pesado.

### Resultado

- Card do Total e reconciliação: **0ms de bloqueio** ao alternar granularidade.
- Composição: skeletons leves na tabela durante a reagregação, sem layout shift.
- Nada muda na lógica de negócio, na URL, no CSV, na paginação ou na validação cruzada.

### Arquivos

- **Editar**: `src/pages/RelatorioKpi.tsx` — adicionar `useTransition` + `useDeferredValue` para `granularity`, renderizar skeleton no `<TableBody>` quando `isPending`, e pequeno spinner no `ToggleGroupItem` ativo durante a transição.
- **Reutilizar**: `src/components/ui/skeleton.tsx` (já existe).

