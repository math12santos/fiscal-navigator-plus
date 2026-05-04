## Objetivo

Disponibilizar o botão **Solicitar Despesa / Reembolso** apenas nos módulos onde colaboradores efetivamente geram gastos operacionais — **DP, Jurídico, TI, CRM (Comercial), Financeiro e Cadastros (futuro Compras)** — e centralizar a triagem em uma nova aba **"Solicitações"** dentro do Financeiro, onde o time financeiro aprova, classifica e provisiona automaticamente no fluxo de caixa.

---

## 1. Componente unificado de solicitação

Generalizar o atual `ExpenseRequestButton` (hoje específico do Financeiro) em um componente reutilizável:

- Novo: `src/components/requests/RequestExpenseButton.tsx`
  - Props: `sourceModule` (`dp` | `juridico` | `ti` | `crm` | `financeiro` | `cadastros`), `defaultCostCenterId?`, `variant?`, `size?`, `label?`.
  - Tabs internas no Dialog: **Despesa** e **Reembolso**.
    - Reembolso adiciona campos: `data_gasto`, `forma_pagamento_pessoal` (cartão pessoal / dinheiro / pix), e marca `subtype = 'reimbursement'` no payload.
  - Mantém anexos (PDF/XML/imagens), sugestão por fornecedor, competência, vencimento, CC, conta contábil, prioridade, justificativa.
  - Persiste `reference_module = sourceModule` para rastreabilidade da origem.
- Deprecação suave: `ExpenseRequestButton.tsx` passa a re-exportar `RequestExpenseButton` com `sourceModule="financeiro"` para não quebrar `ContasAPagar`.

---

## 2. Inserção do botão por módulo

Adicionar `<RequestExpenseButton sourceModule="..." />` no slot `children` do `PageHeader`:

- `src/pages/DepartamentoPessoal.tsx` → `dp` (despesas/reembolsos do RH)
- `src/pages/Juridico.tsx` → `juridico`
- `src/pages/TI.tsx` → `ti`
- `src/pages/CRM.tsx` → `crm` (Departamento Comercial — viagens, brindes, eventos)
- `src/pages/Financeiro.tsx` → `financeiro` (despesas e reembolsos do próprio time)
- `src/pages/Cadastros.tsx` → `cadastros` (futuro Compras)

Nada em Contratos, Planejamento, Tarefas, Dashboard ou BackOffice.

---

## 3. Nova aba "Solicitações" no Financeiro

Adicionar aba dedicada em `src/pages/Financeiro.tsx`:

- Nova entrada em `ALL_TABS`: `{ key: "solicitacoes", label: "Solicitações" }` posicionada logo após **Dashboard**, com badge de contagem de pendentes.
- Novo componente: `src/components/financeiro/SolicitacoesTab.tsx` no padrão `SectionCard` (DP-style).

Estrutura interna (sub-tabs):

1. **Pendentes** — fila a aprovar (status `aberta` / `em_revisao`).
2. **Aprovadas** — já provisionadas, com link para a entrada no fluxo de caixa.
3. **Rejeitadas** — histórico.
4. **Todas** — visão completa com filtros (módulo origem, prioridade, período, solicitante, subtipo despesa/reembolso).
5. SLAs - configuração de SLAs para cada novo tipo de solicitação e sessão para cadastrar políticas de despesas e reembolsos (SLAs para cada tipo de despesa Reembolso permitida) para manter transparência no processo. 

Cada linha exibe: título, solicitante, módulo de origem (badge colorido), subtipo (Despesa/Reembolso), valor estimado, vencimento, competência, prioridade, anexos.

Ações por solicitação pendente:

- **Visualizar** (Drawer): detalhes completos, comentários, anexos, histórico de status.
- **Aprovar e Provisionar** (CTA principal): abre wizard compacto.
- **Solicitar ajuste** (devolve ao solicitante com comentário, status `em_revisao`).
- **Rejeitar** (motivo obrigatório).

A `PendingExpenseRequests` em `ContasAPagar` continua existindo como atalho rápido, mas ganha link "Ver todas" para a nova aba.

---

## 4. Wizard "Aprovar e Provisionar"

Componente `src/components/financeiro/ApproveRequestDialog.tsx`:

- Pré-preenche com dados da solicitação (fornecedor, conta, CC, valor estimado, vencimento, competência, anexos).
- Permite ajustes finais: valor confirmado, parcelamento (1x ou Nx), forma de pagamento, conta bancária prevista, observações.
- Para **reembolso**: força `entity_id` do colaborador (busca em `employees`/cria entidade `funcionario`) e fixa categoria contábil de reembolso.
- Ao confirmar:
  1. Cria `cashflow_entries` (status `provisionado`, `direction='out'`, `source='request'`, `source_ref='request:<id>'`).
  2. Move/vincula anexos do bucket `request-attachments` para `cashflow-attachments`.
  3. Atualiza `requests`: `status='aprovada'`, `cashflow_entry_id`, `classified_by`, `classified_at`.
  4. Cria comentário/auditoria + notificação ao solicitante.
  5. Trigger `bump_org_data_version` em `cashflow_entries` invalida snapshots/Aging List em tempo real.

---

## 5. Notificações & Realtime

- Solicitante recebe notificação em cada transição: `aprovada`, `rejeitada`, `em_revisao`.
- Time financeiro (papel `financeiro`/`admin`/`master`) recebe notificação em toda nova solicitação `aberta`.
- `requests` já está em `useRealtimeSync`; adicionar invalidação da queryKey `requests-financeiro`.

---

## 6. Permissões

- Sem migração nova; reaproveita RLS de `requests` (multi-tenant por `organization_id`).
- Aba "Solicitações" visível para quem tem acesso a `financeiro`. Aprovar/rejeitar exige papel `admin`/`financeiro`/`master` (validado no front via `useUserPermissions` + RLS no backend).
- Botão em cada módulo respeita `useUserPermissions` do módulo de origem (ocultado para perfis somente-leitura).

---

## 7. Detalhes técnicos

- Nenhuma mudança de schema — `requests`, `request_attachments`, `request_comments` já têm os campos necessários (`reference_module`, `cashflow_entry_id`, `entity_id`, `account_id`, `competencia`, `data_vencimento`, `justificativa`).
- Subtipo despesa vs. reembolso vai no campo `description` (JSON já usado): `{ subtype: 'expense' | 'reimbursement', text, estimated_value, ... }`. Helper `parseRequestDescription` centraliza leitura.
- Provisionamento usa `cashflow_entries.status = 'provisionado'` e marca `source = 'request'` para rastreabilidade MECE.
- Memória `mem://features/financial-expense-requests` será atualizada: origem multi-módulo (DP/Jurídico/TI/CRM/Financeiro/Cadastros), aba dedicada, wizard de provisionamento, suporte a reembolso.

---

## Entregáveis

```text
Novo
  src/components/requests/RequestExpenseButton.tsx
  src/components/financeiro/SolicitacoesTab.tsx
  src/components/financeiro/ApproveRequestDialog.tsx
  src/components/financeiro/RequestDetailDrawer.tsx

Editado
  src/components/financeiro/ExpenseRequestButton.tsx  (re-export do novo)
  src/components/financeiro/ContasAPagar.tsx          (link "Ver todas")
  src/pages/Financeiro.tsx                            (nova aba + botão header)
  src/pages/DepartamentoPessoal.tsx                   (botão)
  src/pages/Juridico.tsx                              (botão)
  src/pages/TI.tsx                                    (botão)
  src/pages/CRM.tsx                                   (botão)
  src/pages/Cadastros.tsx                             (botão)
  src/hooks/useRequests.ts                            (filtro reference_module)
  src/hooks/useRealtimeSync.ts                        (queryKey nova)
  .lovable/memory/features/financial-expense-requests.md
  .lovable/plan.md
```

Aprovar para eu implementar?