

# Integração Cross-Module no Contas a Pagar + Fluxo de Aprovação de Despesas

## Problema Atual

- `usePayrollProjections` alimenta o Fluxo de Caixa (`useCashFlow`) mas **não aparece** no módulo Financeiro (`useFinanceiro`)
- Contratos ativos não são exibidos como itens pendentes de classificação financeira
- Não existe fluxo de solicitação/aprovação de despesas por gestores de centro de custo
- Não há detecção de duplicidade de lançamentos

## Plano de Implementação

### 1. Integrar Projeções de Folha no useFinanceiro

**`src/hooks/useFinanceiro.ts`**: Importar `usePayrollProjections` e incluir suas projeções no merge de `allEntries` (apenas para `tipo === "saida"`). De-duplicar contra lançamentos materializados usando a chave `source === "dp"` + `data_prevista`.

### 2. Painel de Pendências Cross-Module

**Novo componente `src/components/financeiro/PendenciasPanel.tsx`**: Um card/alert exibido acima da tabela em ContasAPagar mostrando:

- **Colaboradores sem classificação financeira**: Comparar colaboradores ativos (`useEmployees`) contra lançamentos com `source === "dp"` já materializados. Se não houver lançamento real para o mês corrente, exibir alerta.
- **Contratos sem lançamento financeiro**: Comparar contratos ativos de saída (`useContracts`) contra lançamentos com `source === "contrato"`. Se um contrato ativo não tem parcela ou projeção materializada, exibir alerta.
- Cada pendência terá botão "Classificar" que abre o `FinanceiroEntryDialog` pré-preenchido com os dados do colaborador/contrato.

### 3. Fluxo de Solicitação de Despesas (Request-based)

**Migração SQL**: Adicionar coluna `expense_request_id` (uuid FK → requests) em `cashflow_entries` para vincular despesas a solicitações.

**`src/components/financeiro/ExpenseRequestButton.tsx`**: Botão "Solicitar Despesa" visível para gestores de centro de custo. Ao clicar, cria uma `request` (usando `useCreateRequest`) com:
- `type = "expense_request"`
- `reference_module = "financeiro"`
- `area_responsavel = "financeiro"`
- Dados da despesa nos campos `description` (JSON serializado ou campos complementares)

**Integração no ContasAPagar**: Nova seção "Solicitações Pendentes" que lista requests do tipo `expense_request` com status `aberta`. O financeiro pode aprovar (criando o lançamento) ou rejeitar (atualizando status da request).

### 4. Detecção de Duplicidade

**`src/hooks/useDuplicateDetection.ts`**: Hook que recebe os `entries` e detecta possíveis duplicidades baseado em:
- Mesmo `entity_id` (fornecedor) + valor similar (±5%) + data próxima (±7 dias)
- Retorna array de pares suspeitos

**`src/components/financeiro/DuplicateAlerts.tsx`**: Banner de alerta exibido quando há duplicidades detectadas, com link para comparar os lançamentos lado a lado.

### 5. Atualização do ContasAPagar

**`src/components/financeiro/ContasAPagar.tsx`**: Reorganizar layout:
1. KPI cards (existentes)
2. **PendenciasPanel** — alertas de itens não classificados
3. **DuplicateAlerts** — alertas de possíveis duplicidades
4. Botões: "Nova Despesa" + "Solicitar Despesa"
5. Seção "Solicitações Pendentes" (colapsável)
6. Tabela principal (existente, agora com projeções de folha incluídas)

## Arquivos Afetados

- **Nova migração SQL** — coluna `expense_request_id` em cashflow_entries
- **`src/hooks/useFinanceiro.ts`** — integrar payroll projections
- **`src/hooks/useDuplicateDetection.ts`** — novo hook
- **`src/components/financeiro/PendenciasPanel.tsx`** — novo componente
- **`src/components/financeiro/DuplicateAlerts.tsx`** — novo componente
- **`src/components/financeiro/ExpenseRequestButton.tsx`** — novo componente
- **`src/components/financeiro/ContasAPagar.tsx`** — reorganizar com novos componentes

