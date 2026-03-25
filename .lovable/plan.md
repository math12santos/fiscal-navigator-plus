# Aba "Importações" no Financeiro + Controle de Períodos Fiscais

## Resumo

Criar uma nova aba "Importações" no módulo Financeiro que lista todos os registros de `data_imports`, permite desfazer importações em lote (excluir todos os lançamentos vinculados), e implementa controle de períodos fiscais (mês aberto/fechado) que governa permissões de exclusão e edição. Os períodos serão por competência contábil e por fluxo de caixa vinculado à competência.

## Mudanças no Banco de Dados

### 1. Adicionar `import_id` em `cashflow_entries`

- Nova coluna `import_id UUID REFERENCES data_imports(id) ON DELETE SET NULL`
- Permitirá vincular lançamentos importados ao registro de importação para exclusão em lote

### 2. Criar tabela `fiscal_periods`

```sql
CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,          -- "2025-03"
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, year_month)
);
```

- RLS: membros da org podem ler; apenas owner/admin podem fechar/reabrir

### 3. Atualizar `useFinanceiroImport` para gravar `import_id`

- Na inserção dos `cashflow_entries`, incluir o `import_id` do registro `data_imports` criado

## Mudanças no Frontend

### 4. Nova aba "Importações" em `Financeiro.tsx`

- Adicionar `{ key: "importacoes", label: "Importações" }` ao `ALL_TABS`

### 5. Componente `ImportacoesTab.tsx`

Duas seções:

**Seção A — Histórico de Importações**

- Tabela listando `data_imports` da org: arquivo, data, qtd linhas, status, usuário
- Botão "Desfazer importação" (apenas para admins/owners):
  - Verifica se o período fiscal está aberto
  - Se fechado: mostra alerta "Período fechado — solicite reabertura"
  - Se aberto: confirma via AlertDialog e deleta todos `cashflow_entries` com `import_id` correspondente, depois marca `data_imports.status = 'reverted'`

**Seção B — Períodos Fiscais**

- Grid de meses (últimos 12-24 meses) com status aberto/fechado
- Badge colorido: verde = aberto, vermelho = fechado
- Botões "Fechar período" / "Reabrir período" (apenas owner/admin)
- Meses sem importação mostram indicador visual para guiar o usuário sobre lacunas

### 6. Hook `useImportHistory.ts`

- Query `data_imports` filtrado por org
- Mutation `revertImport(importId)`: deleta entries + atualiza status
- Verifica período fiscal antes de permitir exclusão

### 7. Hook `useFiscalPeriods.ts`

- CRUD de `fiscal_periods` por org
- `isMonthClosed(yearMonth)` helper
- Mutations para fechar/reabrir períodos

## Regras de Negócio

- Somente owner/admin podem excluir importações ou gerenciar períodos
- Exclusão bloqueada se o mês da importação está fechado
- Reabertura de período requer role owner/admin
- O status do período é consultado pelos outros módulos (AP, Aging, Fluxo de Caixa, Conciliação) para bloquear edições em meses fechados

## Arquivos Envolvidos

- **Migração SQL**: `import_id` em cashflow_entries + tabela `fiscal_periods` + RLS
- `src/hooks/useFinanceiroImport.ts` — gravar `import_id` nos entries
- `src/hooks/useImportHistory.ts` — novo hook
- `src/hooks/useFiscalPeriods.ts` — novo hook
- `src/components/financeiro/ImportacoesTab.tsx` — novo componente
- `src/pages/Financeiro.tsx` — adicionar aba