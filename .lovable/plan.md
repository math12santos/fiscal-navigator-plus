

# Adicionar Nível de Subgrupo à Hierarquia (4 níveis)

## Problema

A hierarquia atual tem apenas 2 níveis visíveis (Macrogrupo → Grupo → Entrada). O usuário precisa de até 4 níveis: **Macrogrupo → Grupo → Subgrupo → Título individual**. O campo `sub_group_field` já existe nas regras mas não é usado na construção da hierarquia nem na renderização.

## Solução

### 1. Atualizar `src/lib/groupingHierarchy.ts`

Adicionar nível de **subgrupo** dentro de cada grupo:

- Alterar a estrutura do `GroupBucket` para incluir `subgroups: Map<string, { label: string; entries: any[]; total: number }>`
- Em `buildHierarchy`, ao inserir uma entry num grupo, verificar se a regra tem `sub_group_field`. Se sim, extrair o valor do campo e agrupar dentro de `subgroups`. Se não, colocar diretamente nas entries do grupo.
- Exportar o `getSubGroupKey` e `getSubGroupLabel` do hook de regras para uso na hierarquia.

### 2. Atualizar `src/components/financeiro/FinanceiroTable.tsx`

Adicionar um terceiro nível colapsável entre Grupo e Entrada:

- Novo state `expandedSubgroups`
- Quando um grupo tem subgrupos, renderizar headers de subgrupo (nível 2) com chevron e badge de contagem
- Entries individuais passam para nível 3 (indent `pl-20`)
- Se o grupo não tem subgrupos, manter comportamento atual (entries diretas no nível 2)

### 3. Atualizar `src/components/financeiro/AgingListTab.tsx`

Mesma lógica de 4 níveis na tabela de detalhes do Aging List:

- Novo state `expandedSubgroups`
- Renderizar subgrupos como nível intermediário entre grupo e entrada

### Estrutura visual resultante

```text
▼ Pessoal e RH                    R$ 150.000
  ▼ Encargos                      R$  45.000
    ▼ FGTS                        R$  20.000
        FGTS - João Silva           R$  5.000
        FGTS - Maria Santos         R$  5.000
        ...
    ▼ INSS                        R$  15.000
        ...
    ▼ IRRF                        R$  10.000
        ...
  ▼ Folha                         R$  80.000
      Salário - João Silva          R$ 10.000
      ...
```

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/groupingHierarchy.ts` | Adicionar subgroups ao GroupBucket, popular via `sub_group_field` da regra |
| `src/components/financeiro/FinanceiroTable.tsx` | Renderizar 4 níveis com `expandedSubgroups` |
| `src/components/financeiro/AgingListTab.tsx` | Renderizar 4 níveis com `expandedSubgroups` |

