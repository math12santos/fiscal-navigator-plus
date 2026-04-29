## Diagnóstico

A página **Conciliação Bancária** está 100% mockada — usa `bankReconciliation` de `src/data/mockData.ts`, sem filtro por organização. Por isso o mesmo dado fictício aparece em todas as empresas do grupo Avante Brasil.

Não existe tabela real de conciliação nem de extrato bancário. Existe apenas `bank_accounts` (saldos) e `cashflow_entries` (com colunas já prontas: `conta_bancaria_id`, `data_realizada`, `valor_realizado`, `conciliacao_id`).

Sobre a importação de **Contas a Pagar**: hoje, ao importar uma linha já paga (com data de pagamento preenchida), o sistema marca `status = 'pago'`, mas **não preenche `conta_bancaria_id` nem `valor_realizado`** — então a despesa entra no fluxo de caixa, mas fica órfã da conta bancária e portanto invisível para qualquer rotina de conciliação.

---

## O que será entregue

### 1. Tirar o mock da conciliação (todas as empresas)

- Remover `bankReconciliation` de `src/data/mockData.ts`
- Reescrever `src/pages/Conciliacao.tsx` e `src/components/financeiro/ConciliacaoTab.tsx` para consumir dados reais filtrados por `organization_id`
- Estado vazio amigável quando não houver extrato importado

### 2. Conciliação real com banco de dados

Criar a infraestrutura mínima para conciliação verdadeira:

- Nova tabela `bank_statement_entries` (linhas do extrato bancário importado) — com `organization_id`, `bank_account_id`, `data`, `descricao`, `valor`, `documento`, `import_id`, `source_ref`, `cashflow_entry_id` (vínculo quando conciliada), `status` (`pendente | conciliado | divergente | ignorado`)
- Índice unique parcial `(organization_id, bank_account_id, source_ref)` para idempotência (mesmo padrão dos `cashflow_entries`)
- RLS por organização (mesmo padrão de `bank_accounts`)
- Função `match_statement_to_cashflow(p_statement_id uuid)` que sugere candidatos do `cashflow_entries` por **valor (±2%) + data (±3 dias) + mesma conta bancária**

### 3. Importação de extrato bancário (XLS/CSV)

Reaproveitar 100% o fluxo já existente de Contas a Pagar (`useFinanceiroImport` + `ImportDialog`), criando uma versão dedicada para extrato:

- Novo hook `useBankStatementImport` (mesma estrutura: detect → mapping → preview → entity matching → done)
- Mesmos benefícios já entregues: catálogo de erros com soluções, quick-fix de formato BR/US, deduplicação 3 níveis (intra-arquivo / banco / unique index), batching resiliente, CSV de falhas
- Campos mapeáveis: Data, Histórico/Descrição, Valor (sinal: positivo = crédito, negativo = débito), Documento, Conta Bancária (selecionada antes da importação)
- Botão **"Importar Extrato"** na nova tela de Conciliação

### 4. Reconciliação automática + manual

Na tela de Conciliação:

- KPIs reais: Taxa de conciliação, Divergências, Pendentes (calculados sobre `bank_statement_entries`)
- Lista de linhas do extrato com **sugestão automática** de matching (ranking por proximidade de valor + data)
- Ações por linha: **Conciliar** (vincula a um `cashflow_entry`), **Marcar como divergente**, **Ignorar**, **Criar lançamento a partir do extrato**
- Filtros: por conta bancária, por status, por intervalo de datas

### 5. Corrigir o ciclo "pagamento importado → fluxo de caixa → conciliação"

No `useFinanceiroImport`:

- Quando a linha importada vier com **data de pagamento** preenchida:
  - Preencher `valor_realizado` = valor importado
  - Permitir o usuário escolher **uma conta bancária padrão** para o lote no preview (Select no rodapé do passo Preview) → grava `conta_bancaria_id` em todas as linhas pagas do batch
  - Garantir `status = 'pago'` e `data_realizada` preservada
- Documentar isso na tela final ("X lançamentos pagos vinculados à conta Y, prontos para conciliação")

### 6. Limpeza dos demais mocks órfãos do `mockData.ts`

Verificar e remover qualquer outro export do `mockData.ts` que esteja sendo importado por páginas de produção (escopo limitado: não vou tocar em mocks usados apenas em demo/storybook).

---

## Detalhes técnicos

**Arquivos novos**
- `supabase/migrations/<ts>_bank_statement_entries.sql` — tabela + RLS + índices + função de matching
- `src/hooks/useBankStatementImport.ts` — hook de importação dedicado
- `src/hooks/useConciliacao.ts` — leitura, KPIs e ações de conciliação
- `src/components/financeiro/BankStatementImportDialog.tsx` — wrapper sobre `ImportDialog` configurado para extrato

**Arquivos editados**
- `src/data/mockData.ts` — remove `bankReconciliation`
- `src/pages/Conciliacao.tsx` — reescrito com dados reais
- `src/components/financeiro/ConciliacaoTab.tsx` — reescrito com dados reais
- `src/hooks/useFinanceiroImport.ts` — preencher `conta_bancaria_id` + `valor_realizado` quando linha vier paga
- `src/components/financeiro/ImportDialog.tsx` — Select de "Conta bancária para lançamentos pagos" no passo Preview

**Padrões reusados**
- `source_ref = 'statement_import:<importId>:<rowIndex>'` para garantir idempotência via unique index
- Mesma estratégia de `upsert({ ignoreDuplicates: true, onConflict: 'organization_id,bank_account_id,source_ref' })`
- RLS via `is_org_member` + `has_backoffice_org_access` (mesmo padrão atual)

---

## Observações

- Não vou remover nenhum dado real do banco — o "lixo" da Avante Brasil é só o mock no front-end, então a limpeza é instantânea ao trocar a fonte de dados.
- A conciliação automática usa heurística simples (valor + data + conta). Conciliação por OCR/regras avançadas pode ser próxima iteração.
- Importação de extrato CSV/XLS reaproveita ~90% do código de Contas a Pagar — entrega rápida e consistente.