# Refatoração: Pendências de Classificação → Governança de Despesas

## Contexto

O documento define que a classificação financeira não deve ser um "preenchimento do zero". Toda despesa deve nascer de uma **Solicitação de Despesa** contextualizada por um departamento, e o Financeiro apenas valida, complementa e gera o título no Contas a Pagar.

## Mudanças

### 1. Enriquecer a Solicitação de Despesa (ExpenseRequestButton)

Adicionar campos obrigatórios na criação da solicitação:

- Fornecedor (`entity_id`)
- Categoria inicial (`account_id`)
- Competência prevista
- Data de vencimento prevista
- Justificativa (campo separado do description)

O centro de custo já existe. Restringir seleção de centros de custo aos autorizados para o usuário (usando `useCostCenterPermissions`). Preencher automaticamente o centro de custo padrão do usuário quando disponível. Permitir que o financeiro altere centros de custo. 

**Arquivo**: `src/components/financeiro/ExpenseRequestButton.tsx`

### 2. Reformular o PendenciasPanel → Painel de Triagem

Substituir o painel atual por um com 4 estágios claros:

- **Aguardando triagem**: solicitações aprovadas sem classificação financeira
- **Dados incompletos**: solicitações com campos obrigatórios faltando
- **Prontas para classificação**: solicitações com contexto completo
- **Projeções DP/Contratos**: pendências automáticas agrupadas por evento mestre

Para DP, agrupar projeções por colaborador (ex: "Folha 03/2026 — João") com expansão para ver sub-itens (salário líquido, FGTS, INSS, IRRF).

**Arquivo**: `src/components/financeiro/PendenciasPanel.tsx`

### 3. Novo ClassificacaoDialog (substituir MaterializeDialog para classificação)

Ao clicar "Classificar", abrir um drawer/dialog completo que mostra:

**Seção 1 — Contexto da Solicitação (read-only)**:

- Empresa, departamento, solicitante
- Fornecedor, descrição, justificativa, anexos
- Valor previsto, vencimento, competência

**Seção 2 — Classificação Financeira (editável)**:

- Conta financeira final (plano de contas analíticas)
- Centro de custo (confirmar/ajustar, limitado aos autorizados)
- Natureza contábil
- Regra de rateio (se houver)
- Documento suporte
- Competência e vencimento (confirmar/ajustar)
- Valor previsto vs valor realizado
- Observações internas

**Botão final**: "Classificar e Gerar Título" — materializa a solicitação como entrada real em `cashflow_entries` e atualiza o status da request para `classificada`.

Para projeções DP: mostrar visão consolidada do evento mestre com sub-itens expansíveis, permitindo classificação em batch.

**Arquivo**: `src/components/financeiro/ClassificacaoDialog.tsx` (novo)

### 4. Manter MaterializeDialog como "Valor Executado"

Renomear o dialog atual para `ValorExecutadoDialog` — usado apenas para confirmar valores pagos (double-check da folha no 1º dia útil). Separar conceitualmente da classificação.

**Arquivo**: `src/components/financeiro/MaterializeDialog.tsx` → renomear para `ValorExecutadoDialog.tsx`

### 5. Atualizar ContasAPagar

- Integrar `ClassificacaoDialog` para o fluxo de classificação
- Integrar `ValorExecutadoDialog` para confirmação de valores executados
- Reformular `PendingExpenseRequests` para mostrar solicitações com contexto rico e estágios
- Ao aprovar solicitação → abrir `ClassificacaoDialog` (não o form de nova despesa)

**Arquivo**: `src/components/financeiro/ContasAPagar.tsx`

### 6. Adicionar campos à tabela `requests`

Migração SQL para adicionar:

- `entity_id` (uuid, FK para entities) — fornecedor
- `account_id` (uuid, FK para chart_of_accounts) — categoria inicial
- `competencia` (text) — competência prevista
- `data_vencimento` (date) — vencimento previsto
- `justificativa` (text) — justificativa separada
- `classified_by` (uuid) — quem classificou
- `classified_at` (timestamptz) — quando foi classificado
- `cashflow_entry_id` (uuid, FK para cashflow_entries) — título gerado

### 7. Regras automáticas

- Sugerir categoria/conta com base no fornecedor selecionado (buscar último lançamento do fornecedor)
- Herdar classificação anterior para despesas recorrentes
- Impedir avanço quando campos obrigatórios estiverem vazios

## Arquivos afetados


| Arquivo                                                | Mudança                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/components/financeiro/ExpenseRequestButton.tsx`   | Enriquecer formulário com fornecedor, categoria, competência, vencimento |
| `src/components/financeiro/PendenciasPanel.tsx`        | Reformular para estágios de triagem + agrupamento DP                     |
| `src/components/financeiro/ClassificacaoDialog.tsx`    | **Novo** — dialog completo de classificação financeira                   |
| `src/components/financeiro/MaterializeDialog.tsx`      | Renomear para ValorExecutadoDialog, ajustar textos                       |
| `src/components/financeiro/ContasAPagar.tsx`           | Integrar novos dialogs, reformular fluxo                                 |
| `src/components/financeiro/PendingExpenseRequests.tsx` | Mostrar contexto rico das solicitações                                   |
| `src/hooks/useRequests.ts`                             | Atualizar tipos com novos campos                                         |
| Migração SQL                                           | Adicionar campos à tabela `requests`                                     |
