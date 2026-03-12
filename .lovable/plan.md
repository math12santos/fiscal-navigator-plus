# Reformulação do Formulário de Despesas (Contas a Pagar)

## Resumo

O formulário atual de cadastro de despesas é simplificado demais. O pedido exige uma reformulação completa em 4 seções com novos campos, integrações com plano de contas, fornecedores (entities), rateio entre centros de custo, parcelamento, formas de pagamento, contas bancárias, e projeção automática de despesas fixas/recorrentes no fluxo de caixa.

## Escopo da Implementação

### Fase 1 — Migração de Banco de Dados

Adicionar novas colunas à tabela `cashflow_entries`:


| Campo                       | Tipo                      | Descrição                                                                                   |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| `documento`                 | text                      | Nº da NF, fatura, recibo, DARF, guia                                                        |
| `tipo_despesa`              | text                      | fixa, variável, eventual, recorrente, investimento, impostos, distribuição de lucro, outros |
| `subcategoria_id`           | uuid FK→chart_of_accounts | Subcategoria do plano de contas                                                             |
| `valor_bruto`               | numeric                   | Valor bruto                                                                                 |
| `valor_desconto`            | numeric default 0         | Descontos                                                                                   |
| `valor_juros_multa`         | numeric default 0         | Juros e multa                                                                               |
| `competencia`               | text                      | Formato mm/yy                                                                               |
| `data_vencimento`           | date                      | Data de vencimento                                                                          |
| `data_prevista_pagamento`   | date                      | Data prevista de pagamento                                                                  |
| `natureza_contabil`         | text                      | operacional, administrativa, comercial, financeira, tributária, patrimonial                 |
| `impacto_fluxo_caixa`       | boolean default true      | Impacta fluxo de caixa                                                                      |
| `impacto_orcamento`         | boolean default true      | Impacta orçamento                                                                           |
| `afeta_caixa_no_vencimento` | boolean default true      | Quando afetar o caixa                                                                       |
| `conta_contabil_ref`        | text                      | Conta contábil referencial                                                                  |
| `forma_pagamento`           | text                      | PIX, boleto, TED, etc.                                                                      |
| `conta_bancaria_id`         | uuid FK→bank_accounts     | Conta bancária pagadora                                                                     |
| `num_parcelas`              | int                       | Nº de parcelas                                                                              |
| `acordo_id`                 | uuid                      | ID do acordo (para aglutinação)                                                             |
| `conciliacao_id`            | text                      | ID da conciliação bancária                                                                  |
| `recorrencia`               | text                      | mensal, semanal, etc. (para projeção)                                                       |


Criar tabela `bank_accounts`:

- id, organization_id, user_id, nome, banco, agencia, conta, tipo_conta, pix_key, active, created_at

Criar tabela `payment_methods`:

- id, organization_id, name, active, is_default, created_at

Criar tabela `expense_cost_center_splits` (para rateio):

- id, cashflow_entry_id FK, cost_center_id FK, percentual numeric, valor numeric, created_at

Criar tabela `supplier_agreements` (para aglutinação de despesas):

- id, organization_id, entity_id FK, descricao, valor_total, status, data_acordo, created_at

### Fase 2 — Reformulação do Formulário (UI)

Substituir `FinanceiroEntryDialog` por um dialog com **4 abas** (Accordion ou Tabs):

**Aba 1 — Identificação**

- Nome (descricao)
- Documento (NF, fatura, etc.)
- Tipo de documento: nota fiscal, fatura, recibo, contrato n°, Darf, Guia
- Fornecedor → Select buscável de entities (type="fornecedor"), com botão "+" para cadastro inline via EntityFormDialog
- Tipo → fixa, variável, eventual, recorrente, investimento, impostos, distribuição de lucro, outros
- Categoria principal → Select do plano de contas (nível 2, contas sintéticas)
- Subcategoria → Select filtrado pelo pai selecionado (nível 3, contas analíticas)
- Empresa/Unidade → Auto-preenchida no modo empresa; Select no modo holding (activeOrgIds)
- Centro de Custo → Select de cost_centers

**Aba 2 — Dados Financeiros**

- Valor Bruto, Descontos, Juros/Multa
- Valor Líquido (calculado automaticamente: bruto - desconto + juros)
- Competência (mm/yy)
- Data de Vencimento
- Data Prevista de Pagamento
- Data Efetiva de Pagamento (readonly, vinculada ao botão "Pagar")

**Aba 3 — Natureza Contábil**

- Classificação no plano de contas (account_id)
- Natureza: operacional, administrativa, comercial, financeira, tributária, patrimonial
- Impacto no fluxo de caixa: Switch sim/não
- Impacto em orçamento: Switch sim/não
- Afeta caixa no vencimento: Switch
- Rateio entre centros de custo (tabela dinâmica com % e valor absoluto)
- Conta contábil referencial (text input)

**Aba 4 — Pagamento e Liquidação**

- Forma de pagamento: Select (PIX, boleto, TED, cartão, débito automático) + opção "outra"
- Conta bancária pagadora: Select de bank_accounts + botão "+" para cadastrar
- Parcelamento: Switch → campos de nº parcelas / valor total
- Status: pendente, agendada, paga, vencida, cancelada, renegociada
- Conciliação bancária (readonly, exibe vínculo se existir)

### Fase 3 — Hook e Lógica de Negócio

**Atualizar `useFinanceiro.ts**`:

- Expandir `FinanceiroInput` com todos os novos campos
- Create mutation: se tipo_despesa = "fixa" ou "recorrente", gerar projeções automáticas (12 meses) no fluxo de caixa
- Lógica de parcelamento: ao salvar com num_parcelas > 1, criar N registros com data_vencimento incrementada mensalmente

**Criar `useBankAccounts.ts**`: CRUD para contas bancárias
**Criar `usePaymentMethods.ts**`: CRUD para formas de pagamento
**Criar `useExpenseSplits.ts**`: CRUD para rateio de centros de custo
**Criar `useSupplierAgreements.ts**`: Lógica de aglutinação — selecionar despesas de um fornecedor, somar valores, criar acordo, dar baixa nas despesas originais

### Fase 4 — Componentes Auxiliares

- `CostCenterSplitEditor.tsx` — Tabela inline para editar rateio (% ou valor absoluto, com validação de 100%)
- `BankAccountSelect.tsx` — Select com cadastro inline
- `SupplierAgreementDialog.tsx` — Wizard para aglutinar despesas de um fornecedor

### Fase 5 — RLS para novas tabelas

Aplicar o padrão existente: `is_org_member(org_id) OR has_backoffice_org_access(org_id)` para SELECT/INSERT/UPDATE/DELETE em bank_accounts, payment_methods, expense_cost_center_splits, supplier_agreements.

## Arquivos Afetados

- **Nova migração SQL** — novas colunas em cashflow_entries + 4 novas tabelas + RLS
- `**src/components/financeiro/FinanceiroEntryDialog.tsx**` — Reescrita completa com 4 abas
- `**src/components/financeiro/CostCenterSplitEditor.tsx**` — Novo componente de rateio
- `**src/components/financeiro/BankAccountSelect.tsx**` — Novo select inline
- `**src/components/financeiro/SupplierAgreementDialog.tsx**` — Novo dialog de aglutinação
- `**src/hooks/useFinanceiro.ts**` — Expandir FinanceiroInput e lógica de projeção/parcelamento
- `**src/hooks/useBankAccounts.ts**` — Novo hook
- `**src/hooks/usePaymentMethods.ts**` — Novo hook
- `**src/hooks/useExpenseSplits.ts**` — Novo hook
- `**src/hooks/useSupplierAgreements.ts**` — Novo hook
- `**src/components/financeiro/ContasAPagar.tsx**` — Botão de aglutinação
- `**src/components/financeiro/FinanceiroTable.tsx**` — Colunas adicionais (documento, fornecedor, vencimento)

## Observações

- A lógica de "Fornecedor" reutiliza a tabela `entities` existente (type="fornecedor"), sem criar tabela nova.
- O campo `valor_previsto` existente será calculado como valor líquido (bruto - desconto + juros) para manter compatibilidade com o fluxo de caixa.
- Despesas recorrentes usarão a mesma engine de projeção de `contractProjections.ts`, adaptada para despesas avulsas.
- A conciliação bancária está atualmente em mock — o campo será placeholder para futura integração.