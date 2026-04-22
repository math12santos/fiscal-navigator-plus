

# Plano: Garantir que `filters` nunca seja `undefined` (sempre `EMPTY_PLANNING_FILTERS`)

## Objetivo
Endurecer todos os pontos onde `PlanningFilters` trafega para que, mesmo se um chamador esquecer de passar a prop ou passar `undefined`/`null`/objeto parcial, o sistema use silenciosamente `EMPTY_PLANNING_FILTERS`. Hoje a maioria dos consumidores já tem default, mas existem três pontos vulneráveis: a fonte (`Planejamento.tsx` lê do URL "na mão"), os hooks de export/histórico (sem default) e o `setFilters` (aceita qualquer coisa).

## Comportamento esperado

- **Fonte única**: o objeto `filters` derivado do URL passa por `normalizeFilters` e nunca é `undefined`/parcial — campos faltando viram defaults de `EMPTY_PLANNING_FILTERS`.
- **Setter defensivo**: `setFilters(undefined as any)` ou `setFilters({} as any)` resulta em `EMPTY_PLANNING_FILTERS` no URL (todos os params removidos), em vez de jogar erro ou gravar `undefined`.
- **Default uniforme**: todo consumidor (`PlanningCockpit`, `PlannedVsActual`, `PlanningBudget`, `usePlanningPdfReport`, `useFinancialSummary`, `PlanningReportHistory`, `usePlanningReportExports`) declara `filters?: PlanningFilters` com default `EMPTY_PLANNING_FILTERS` — nada de `filters: PlanningFilters` obrigatório que estoure se chamado sem prop.
- **Helper único**: nova função `withFilterDefaults(input?)` em `planningFilters.ts` que delega para `normalizeFilters` e devolve um novo objeto seguro. Substitui pequenas variações espalhadas.

## Mudanças técnicas

### 1. `src/lib/planningFilters.ts`
- Renomear/expor `withFilterDefaults(input?: Partial<PlanningFilters> | null | undefined): PlanningFilters` como wrapper fino sobre `normalizeFilters` (aceita explicitamente `undefined`/`null`).
- Ajustar `normalizeFilters` para também tolerar quando `input.bankAccountIds` vier como `null` (hoje só trata array/string).

### 2. `src/pages/Planejamento.tsx`
- `useMemo<PlanningFilters>` que lê o URL passa o objeto bruto por `withFilterDefaults({ subsidiaryOrgId, bankAccountIds, costCenterIds })` antes de retornar — garante shape consistente mesmo se `searchParams.get("org")` vier vazio (`""`).
- `setFilters` interno chama `withFilterDefaults(next)` antes de serializar; `next === undefined` ou objeto parcial → URL é limpo para o estado vazio.

### 3. Hooks/componentes consumidores — uniformizar default
Tornar `filters?: PlanningFilters` opcional **e** aplicar default `EMPTY_PLANNING_FILTERS` (alguns já têm, outros não):

- `src/hooks/usePlanningReportExports.ts`: `filters?: PlanningFilters` com default no destructuring de `recordExport({ filters = EMPTY_PLANNING_FILTERS, ... })`.
- `src/components/planning/PlanningReportHistory.tsx`: `filters?: PlanningFilters = EMPTY_PLANNING_FILTERS` no `RedownloadRow` e na prop principal.
- `src/components/planning/PlanningBudget.tsx`: já recebe `filters?` mas repassa cru para `PlannedVsActual` — adicionar default no destructuring e repassar `filters ?? EMPTY_PLANNING_FILTERS`.
- `PlanningCockpit.tsx`, `PlannedVsActual.tsx`, `usePlanningPdfReport.ts`, `useFinancialSummary.ts`: já têm default, sem mudança.

### 4. Sanitização (`useEffect` em `Planejamento.tsx`)
Como `filters` agora é garantido pelo `withFilterDefaults`, a guarda `if (!hasAnyFilter(filters)) return;` continua válida e o effect fica mais previsível (sem early-undefined-crash).

## Garantias

- **Zero crash por `undefined`**: nenhum chamador, novo ou antigo, consegue passar `filters` inválido — o tipo aceita `undefined` e o default cobre.
- **Coerência visual + cálculo**: como o objeto sempre tem o mesmo shape, os matchers (`entryMatchesFilters`, `contractMatchesFilters`) nunca quebram com `Cannot read property 'includes' of undefined`.
- **Sem regressão de URL**: filtros já compartilhados continuam sendo lidos exatamente igual; `withFilterDefaults` só preenche o que faltar.
- **Auditável**: única fonte de defaults (`EMPTY_PLANNING_FILTERS`) reforça o princípio "uma única verdade" — qualquer alteração futura no shape do filtro propaga automaticamente.

## Arquivos afetados
- **Editado:** `src/lib/planningFilters.ts` (novo `withFilterDefaults`, robustez do `normalizeFilters`)
- **Editado:** `src/pages/Planejamento.tsx` (aplica `withFilterDefaults` no `useMemo` do filtro e no `setFilters`)
- **Editado:** `src/components/planning/PlanningBudget.tsx` (default + repassa garantido)
- **Editado:** `src/components/planning/PlanningReportHistory.tsx` (default na prop)
- **Editado:** `src/hooks/usePlanningReportExports.ts` (default no `recordExport`)

