

# Configuração de Regras de Aglutinação

## Objetivo

Criar uma aba "Aglutinação" dentro da página de Configurações (`/configuracoes`) para permitir que o usuário gerencie regras de agrupamento de forma visual e persistente. Essas regras serão consumidas pelo Aging List e pelo FinanceiroTable.

## Arquitetura

### 1. Tabela no banco: `grouping_rules`

```sql
CREATE TABLE public.grouping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,                    -- ex: "Pessoal", "Impostos"
  match_field text NOT NULL DEFAULT 'categoria', -- 'categoria' | 'source' | 'entity_id'
  match_value text NOT NULL,             -- valor a comparar (ex: "Pessoal", "dp", uuid de entity)
  sub_group_field text,                  -- campo para sub-agrupamento: 'dp_sub_category' | 'entity_id' | null
  min_items int NOT NULL DEFAULT 2,      -- threshold mínimo para aglutinar
  enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,       -- ordem de aplicação
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

RLS: membros da organização podem ler/gravar suas regras.

### 2. Seed de regras padrão

Ao criar a tabela, popular com as regras que já existem hardcoded:
- Pessoal (match_field=source, match_value=dp, sub_group_field=dp_sub_category)
- Contratos (match_field=source, match_value=contrato, sub_group_field=entity_id)

### 3. Hook: `useGroupingRules`

- CRUD na tabela `grouping_rules` filtrado por `organization_id`
- Expõe função `getGroupConfig(entry)` que retorna a regra aplicável a uma entrada
- Fallback: se nenhuma regra bate e há 2+ itens com mesma categoria, aglutinar sem sub-grupo

### 4. Aba na página Configurações

Adicionar tab "Aglutinação" em `src/pages/Configuracoes.tsx`:
- Tabela listando regras existentes (nome, campo de match, valor, sub-agrupamento, min itens, ativo/inativo)
- Botão "Nova Regra" abre dialog com formulário:
  - Nome da regra
  - Campo de agrupamento (select: Categoria, Fonte, Fornecedor)
  - Valor (input ou select dependendo do campo)
  - Campo de sub-agrupamento (opcional, select)
  - Mínimo de itens (number input, default 2)
  - Prioridade (number)
- Edição inline e toggle ativo/inativo

### 5. Consumir regras no AgingListTab e FinanceiroTable

Substituir lógica hardcoded de `getGroupLabel`, `getSubGroupKey`, `GROUPABLE_CATEGORIES`, `GROUPABLE_SOURCES` pelo hook `useGroupingRules`:
- Para cada entrada, verificar se alguma regra ativa faz match
- Se sim, usar `name` como label do grupo e `sub_group_field` para o nível 2
- Se não, manter comportamento fallback (aglutina por categoria se 2+ itens)

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `grouping_rules` + seed + RLS |
| `src/hooks/useGroupingRules.ts` | Novo hook CRUD + matcher |
| `src/components/financeiro/GroupingRuleDialog.tsx` | Dialog de criação/edição de regra |
| `src/pages/Configuracoes.tsx` | Adicionar tab "Aglutinação" |
| `src/components/financeiro/AgingListTab.tsx` | Consumir regras do hook |
| `src/components/financeiro/FinanceiroTable.tsx` | Consumir regras do hook |

