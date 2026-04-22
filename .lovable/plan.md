

# Plano: Seleção múltipla para Conta Bancária e Centro de Custo nos filtros

## Objetivo

Permitir comparar rapidamente recortes compostos (ex.: duas filiais + três centros de custo) sem precisar exportar várias vezes. Hoje cada dimensão aceita apenas um valor; vamos transformar **Conta Bancária** e **Centro de Custo** em multi-seleção, mantendo **Unidade (subsidiária)** como single-select (faz parte do contexto de holding e não admite mistura).

## Comportamento esperado

- **Filtro de Conta Bancária**: lista de checkboxes com busca; usuário marca quantas contas quiser. Sem nada marcado = "Todas".
- **Filtro de Centro de Custo**: idem, com busca por código/nome.
- **Badge no botão "Filtros"** continua mostrando o total de dimensões com filtro ativo (não a soma de itens).
- **Resumo no PDF e no histórico**: passa a listar os nomes selecionados separados por vírgula. Se houver mais de 3 itens em uma dimensão, exibe os 2 primeiros + "(+N)" para evitar estouro de linha.
- **URL compartilhável**: `?conta=<uuid1>,<uuid2>&cc=<uuid3>,<uuid4>` — ainda permite recarregar e compartilhar a mesma visão.
- **Sem regressão**: filtros existentes salvos como string única no histórico continuam sendo lidos corretamente (compatibilidade ascendente).

## Mudanças técnicas

### 1. `src/lib/planningFilters.ts` — modelo
```ts
export interface PlanningFilters {
  subsidiaryOrgId: string | null;        // segue single
  bankAccountIds: string[];              // [] = todas
  costCenterIds: string[];               // [] = todos
}
```
- `EMPTY_PLANNING_FILTERS` usa arrays vazios.
- `hasAnyFilter`: true se qualquer dimensão tem valor.
- `entryMatchesFilters` / `contractMatchesFilters`: trocam `===` por `array.includes()` (com early-return se array vazio = "sem filtro").

### 2. `src/pages/Planejamento.tsx` — URL + UI
- **Serialização URL**: `params.set("conta", ids.join(","))` quando `ids.length > 0`; `params.delete("conta")` quando vazio. Idem para `cc`. Leitura: `searchParams.get("conta")?.split(",").filter(Boolean) ?? []`.
- **`FilterPopover`**: substituir os dois `Select` por um componente simples de **multi-select com checkbox + busca** inline (sem nova dependência — usar `Popover` interno ou lista com `Checkbox` já existentes em `@/components/ui/checkbox` + `Input` de busca). Cabeçalho de cada dimensão mostra "Todas" / "N selecionadas".
- **Badge contador** continua somando dimensões ativas (não itens).

### 3. `src/hooks/useFinancialSummary.ts` / `PlanningCockpit.tsx` / `PlannedVsActual.tsx`
- Nenhuma mudança de lógica de cálculo — basta consumir os matchers atualizados (que agora aceitam arrays). Como já passam `filters` para `entryMatchesFilters`/`contractMatchesFilters`, a propagação é automática.

### 4. `src/hooks/usePlanningPdfReport.ts` — resumo
- Trocar bloco de `filterParts` para mapear arrays:
```ts
const fmt = (ids, lookup, label) => {
  if (ids.length === 0) return null;
  const names = ids.map(id => lookup(id)).filter(Boolean);
  const head = names.slice(0, 2).join(", ");
  const tail = names.length > 2 ? ` (+${names.length - 2})` : "";
  return `${label}: ${head}${tail}`;
};
```
- Aplica para Conta e CC; Unidade segue single.

### 5. `PlanningReportHistory.tsx` / `usePlanningReportExports.ts`
- Sem mudança de schema (`filters` é `Json`, suporta arrays). O campo `filters_summary` já é texto livre — herda o novo formato automaticamente.
- **Compatibilidade com histórico antigo**: ao reabrir um registro salvo no formato antigo (com `bankAccountId: "uuid"`), normalizamos no momento da leitura: se for string, vira `[string]`; se ausente/null, vira `[]`. Adicionamos um pequeno helper `normalizeFilters()` em `planningFilters.ts` e usamos em `RedownloadRow`.

## Arquivos afetados

- **Editado:** `src/lib/planningFilters.ts` (modelo, matchers, helper `normalizeFilters`)
- **Editado:** `src/pages/Planejamento.tsx` (URL + nova UI multi-select no `FilterPopover`)
- **Editado:** `src/hooks/usePlanningPdfReport.ts` (resumo de filtros)
- **Editado:** `src/components/planning/PlanningReportHistory.tsx` (normaliza filtros antigos antes de regerar)
- **Sem mudanças funcionais (apenas tipo):** `useFinancialSummary.ts`, `PlanningCockpit.tsx`, `PlannedVsActual.tsx` — já consomem os matchers via `filters`.

## Garantias

- **Comparação rápida**: usuário marca várias contas/CCs, vê tudo consolidado em uma só visão e exporta um único PDF representando a combinação.
- **Coerência total**: como o filtro flui pelo mesmo `useFinancialSummary` que já alimenta Cockpit, Plan×Real×Projetado e PDF, todos os números continuam batendo (princípio reforçado nas iterações anteriores).
- **Nenhuma quebra de histórico**: PDFs antigos continuam re-baixáveis graças ao `normalizeFilters`.

