

# 3 Níveis Hierárquicos: Macrogrupo → Grupo → Entrada

## Objetivo

Atualizar AgingListTab e FinanceiroTable para agrupar entradas em 3 níveis colapsáveis usando a hierarquia de macrogrupos/grupos configurada, mantendo a lógica de aglutinação desacoplada de futuros templates de cadastro.

## Mudança no Hook `useGroupingRules`

Adicionar uma função `getMacrogroupId(entry)` que resolve: entry → rule → group_id → grupo → macrogroup_id. Também adicionar `getHierarchyInfo(entry)` que retorna `{ macrogroupId, macrogroupName, groupId, groupName, ruleName }` para consumo direto nos componentes.

**Arquivo**: `src/hooks/useGroupingRules.ts`
- Aceitar `macrogroups` e `groups` como dependência (passar via parâmetro ou importar `useGroupingMacrogroups` internamente)
- Nova função `getHierarchyInfo(entry)` que retorna o caminho completo: macrogrupo → grupo → regra
- Fallback: se rule não tem group_id, usar macrogrupo "Não Classificado" virtual

## AgingListTab — 3 Níveis

**Arquivo**: `src/components/financeiro/AgingListTab.tsx`

Refatorar `renderBucketRows` para:

1. **Nível 0 — Macrogrupo**: Row com ícone, nome, badge com contagem total, valor total. Clicável para expandir/colapsar.
2. **Nível 1 — Grupo**: Row indentado (pl-8), nome do grupo, contagem, valor. Clicável.
3. **Nível 2 — Entrada**: Row individual indentado (pl-14), como já existe.

Lógica de agrupamento no `useMemo`:
- Para cada entry no bucket, chamar `getHierarchyInfo(entry)`
- Agrupar por `macrogroupId` → dentro por `groupId` → entries
- Macrogrupo "Não Classificado" para entries sem match
- Totalizadores em cada nível

## FinanceiroTable — 3 Níveis

**Arquivo**: `src/components/financeiro/FinanceiroTable.tsx`

Refatorar `displayRows` para usar a mesma lógica hierárquica:

1. **Nível 0 — Macrogrupo + Mês**: Agrupamento por macrogrupo dentro do mesmo mês
2. **Nível 1 — Grupo**: Subgrupos dentro do macrogrupo
3. **Nível 2 — Entrada individual**

Manter a lógica existente de `minItems` — se um macrogrupo tem menos itens que o threshold, os itens aparecem como singles.

## Estado de Expansão

Adicionar um terceiro nível de `expandedMacrogroups` (Set) nos dois componentes, além dos `expandedGroups` e `expandedSubGroups` já existentes.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useGroupingRules.ts` | Adicionar `getHierarchyInfo()` usando dados de macrogroups/groups |
| `src/components/financeiro/AgingListTab.tsx` | Refatorar agrupamento para 3 níveis com totalizadores |
| `src/components/financeiro/FinanceiroTable.tsx` | Mesma refatoração de 3 níveis |

