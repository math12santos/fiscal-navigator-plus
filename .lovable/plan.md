# Consolidar Fluxo de Caixa e Conciliação como abas do Financeiro + Saldo Manual + Nome da empresa em Holding

## Resumo

Três mudanças:

1. Mover Fluxo de Caixa e Conciliação para dentro do módulo Financeiro como abas
2. Adicionar botão de "Inserir Saldo" na aba Contas Bancárias (saldo manual = verdade absoluta para Aging List e comparar saldo manual com saldo de conciliação para indicar correções necessárias)
3. Mostrar nome da empresa (não UUID) na coluna "Empresa" do modo holding consolidado

## Mudanças

### 1. Financeiro.tsx — Adicionar abas Fluxo de Caixa e Conciliação

- Adicionar `{ key: "fluxo-caixa", label: "Fluxo de Caixa" }` e `{ key: "conciliacao", label: "Conciliação" }` ao `ALL_TABS`
- Importar e renderizar os conteúdos existentes de `FluxoCaixa` (inline, sem PageHeader) e `Conciliacao` (inline, sem PageHeader)
- Criar componentes wrapper (`FluxoCaixaTab` e `ConciliacaoTab`) que reutilizam toda a lógica dos pages atuais mas sem o PageHeader redundante

### 2. App.tsx — Remover rotas standalone

- Remover as rotas `/fluxo-caixa` e `/conciliacao`
- Remover os lazy imports de `FluxoCaixa` e `Conciliacao`
- Adicionar redirects de `/fluxo-caixa` → `/financeiro` e `/conciliacao` → `/financeiro` para links antigos

### 3. AppLayout.tsx — Remover itens de navegação

- Remover `{ path: "/fluxo-caixa", ... }` e `{ path: "/conciliacao", ... }` do array `navItems`

### 4. moduleDefinitions.ts — Consolidar módulos

- Remover entries standalone de `fluxo-caixa` e `conciliacao`
- Adicionar `"fluxo-caixa"` e `"conciliacao"` como tabs dentro do módulo `financeiro`

### 5. ContasBancariasTab.tsx — Botão "Inserir Saldo" + Nome da empresa

**Saldo manual:**

- Adicionar coluna "Saldo" na tabela com o valor de `saldo_atual` formatado
- Adicionar botão/ícone em cada linha para abrir um dialog simples de inserção de saldo
- O dialog atualiza `saldo_atual` via `update.mutate({ id, saldo_atual: valor })`
- Registrar `data_atualizacao_saldo` para auditoria (campo timestamp já existe ou será adicionado)

**Nome da empresa em holding:**

- Usar `subsidiaryOrgs` + `currentOrg` do `useHolding()` e `useOrganization()` para montar um mapa `orgId → orgName`
- Substituir `acc.organization_id?.slice(0, 8)` pelo nome real da organização

### 6. Migração SQL — Coluna de auditoria de saldo

```sql
ALTER TABLE bank_accounts 
  ADD COLUMN IF NOT EXISTS saldo_atualizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS saldo_atualizado_por UUID REFERENCES auth.users(id);
```

### 7. useBankAccounts.ts — Mutation de saldo

- Adicionar mutation `updateBalance(id, saldo_atual)` que também grava `saldo_atualizado_em = now()` e `saldo_atualizado_por = user.id`

## Arquivos envolvidos

- `src/pages/Financeiro.tsx` — adicionar 2 abas
- `src/components/financeiro/FluxoCaixaTab.tsx` — novo wrapper (conteúdo do FluxoCaixa sem PageHeader)
- `src/components/financeiro/ConciliacaoTab.tsx` — novo wrapper (conteúdo do Conciliacao sem PageHeader)
- `src/components/financeiro/ContasBancariasTab.tsx` — saldo manual + nome empresa
- `src/App.tsx` — remover rotas, adicionar redirects
- `src/components/AppLayout.tsx` — remover nav items
- `src/data/moduleDefinitions.ts` — consolidar definições
- `src/hooks/useBankAccounts.ts` — mutation de saldo com auditoria
- Migração SQL — colunas de auditoria de saldo