
# Módulo de Compras — FinCore

Camada de governança da jornada de compra que conecta necessidade operacional → orçamento → contas a pagar → fluxo de caixa. Não é cadastro: é controle de **caixa futuro** antes de virar obrigação.

Entrega em **3 fases**, com nova tabela `suppliers` dedicada e validação orçamentária **híbrida** (puxa de Planejamento; se não houver, marca "Sem orçamento" + exige justificativa).

---

## Fase 1 — MVP funcional

### Backend (migration única)

**Tabelas novas:**
- `suppliers` — fornecedores dedicados de Compras (separado de `entities`, mas com `entity_id` opcional para reuso). Campos: razão social, nome fantasia, CNPJ/CPF, IE/IM, tipo, categorias atendidas (text[]), contato, e-mail, telefone, endereço, dados bancários, condições comerciais, prazo médio entrega, status (`ativo|inativo|bloqueado|em_homologacao`), avaliação (1-5), observações.
- `purchase_requests` — solicitação. Campos: código auto (`SOL-AAAA-NNNN`), org, empresa, departamento, cost_center_id, projeto, solicitante (user_id), data_solicitacao, data_desejada_entrega, tipo_compra (enum 11 valores), categoria, account_id (plano de contas), descrição, justificativa, prioridade, valor_estimado, status (rascunho→enviada→em_analise→aprovada/reprovada/ajuste→em_cotacao→pedido_gerado→cancelada→concluida), fora_orcamento (bool), justificativa_extra, anexos (jsonb).
- `purchase_request_items` — itens (nome, descrição, qtd, unidade, valor unit, total, categoria).
- `purchase_approvals` — fluxo de aprovação. Campos: request_id, approver_id, ordem, status (pendente|aprovado|reprovado|ajuste_solicitado|delegado), comentário, decided_at.
- `purchase_approval_rules` — regras configuráveis por org. Campos: nome, escopo (valor/cc/empresa/categoria/tipo/fora_orc/emergencial), faixa_min/max, approver_role ou approver_user_id, ordem, ativo.
- `purchase_orders` — pedido. Campos: código auto (`PED-AAAA-NNNN`), request_id, supplier_id, empresa, cost_center_id, account_id, valor_total, condicao_pagamento, forma_pagamento, data_prevista_entrega, data_prevista_pagamento, responsavel, status (emitido→enviado→confirmado→…→concluido), observações.
- `purchase_order_items` — itens do pedido.
- `purchase_audit_log` — log de toda alteração relevante (request, approval, order, cancel).

**Extensões:**
- `cashflow_entries`: já tem `expense_request_id`. Adicionar `purchase_order_id uuid` (FK opcional) + status `previsto_por_pedido`.
- Storage bucket `purchases/` com isolamento por org prefix.

**Funções/Triggers:**
- `generate_purchase_code(prefix)` — sequencial por org/ano.
- Trigger em `purchase_requests`: ao status `aprovada`, materializa cadeia de aprovação a partir das `purchase_approval_rules`.
- Trigger em `purchase_orders`: ao status `emitido`, cria `cashflow_entry` previsto (status=`previsto_por_pedido`, vinculado ao pedido + solicitação + contrato se houver).
- Trigger em `cashflow_entries` (NF recebida): muda de previsto→confirmado.
- RPC `check_budget_availability(cost_center_id, account_id, competencia, valor)` → retorna `{planejado, realizado, comprometido, saldo, situacao}`. Lê de `financial_planning`/`budget_items` (Planejamento). Se não encontrar, retorna `situacao='sem_orcamento'`.
- RLS: org-scoped padrão; aprovador vê o que é dele; solicitante vê suas solicitações; financeiro/diretoria vê tudo.

### Frontend

Rota `/compras` no menu lateral (ícone ShoppingCart) com `Tabs` no padrão SectionCard:

1. **Dashboard** (cards principais + gráficos básicos: por CC, por categoria, evolução mensal, aprovado vs orçamento).
2. **Solicitações** — lista filtrável + wizard focado (Accordion: Identificação → Itens → Classificação financeira → Validação orçamentária → Anexos → Revisão). Badge de status. `BudgetIndicator` mostra planejado/realizado/comprometido/saldo com cor (verde/amarelo/vermelho/cinza).
3. **Aprovações** — fila do usuário aprovador com botões Aprovar/Reprovar/Ajustar/Delegar/Comentar e impacto no caixa.
4. **Pedidos de Compra** — gerar pedido a partir de solicitação aprovada; PDF do pedido (jspdf+autotable, padrão Cash Position PDF); botão "Enviar ao Financeiro".
5. **Fornecedores** — CRUD `suppliers` com avaliação e indicadores básicos (total comprado, nº pedidos).
6. **Configurações** — tipos, categorias, unidades, regras de aprovação (alçadas).

Hooks: `usePurchaseRequests`, `usePurchaseApprovals`, `usePurchaseOrders`, `useSuppliers`, `useApprovalRules`, `useBudgetCheck`. Usar `cachePresets.operational` + realtime em `purchase_requests`/`purchase_approvals`.

Permissões via `useUserPermissions` (módulo `compras`, abas: solicitar, aprovar, comprar, financeiro, diretoria, admin).

---

## Fase 2 — Cotações, Recebimentos, Divergências

- `purchase_quotations` + `purchase_quotation_suppliers` (múltiplos fornecedores por cotação) + `purchase_quotation_items`. Cálculo de economia (maior proposta − escolhida).
- `purchase_receipts` (produto: qtd recebida, conformidade; serviço: período, aceite, avaliação) + status (recebido_total/parcial/divergencia/recusado).
- `purchase_divergences` (qtd, valor, atraso, qualidade) com workflow de tratativa.
- Aba "Cotações" e "Recebimentos" no menu Compras.
- Indicadores no Dashboard: economia obtida, divergências por fornecedor, prazo médio.

---

## Fase 3 — Recorrência, Contratos, Ativos, Notificações

- Compra recorrente: `purchase_recurrences` (periodicidade, vigência, reajuste) que materializa novas solicitações automáticas.
- Vínculo com **Contratos**: ao escolher tipo "Vinculada a contrato", puxar fornecedor/vigência/saldo do `contracts`. Pedido consome `contract_installments`.
- Vínculo com **Ativos**: tipo "Ativo imobilizado" cria registro em `assets` (já existe?) ou gera lançamento de depreciação no Financeiro (60/48m, padrão TI).
- Notificações via `notifications` + Slack (Edge Function existente): solicitação pendente, fora do orçamento, emergencial, atraso, NF pendente.
- Configurações avançadas: motivos de reprovação, motivos de emergencial, critérios de homologação, integrações.

---

## Detalhes técnicos

```text
purchase_requests ──┬──> purchase_approvals (cadeia)
                    │
                    └──> purchase_orders ──> cashflow_entries (previsto→confirmado)
                                          └─ PDF do pedido
suppliers <──────── purchase_orders / purchase_quotations
purchase_approval_rules ──> motor de aprovação por valor/CC/categoria/tipo
RPC check_budget_availability ──> Planejamento (financial_planning) ou "sem_orcamento"
```

**Padrões a seguir** (já vigentes no projeto):
- SectionCard + Tabs com `bg-muted/40 border p-1 h-auto`.
- Focused Wizard (Accordion único aberto).
- CurrencyInput (já existe).
- Códigos sequenciais por org/ano (padrão `generate_*_code`).
- MECE: pedido→cashflow_entry idempotente via `source_ref='purchase_order:<id>'`.
- Sem `console.error` em produção; CORS whitelist nas Edge Functions.
- Storage isolado por prefix da org.
- Realtime via `useRealtimeSync` nas tabelas operacionais.

## Fora de escopo (mesmo na Fase 3)
- Integração com módulos de Estoque/BI/Telegram/IA de classificação automática (mencionados como "evoluções" no documento, não MVP).
- Importação em massa de fornecedores via XLSX (pode ficar para depois).

## Próximo passo
Aprovar o plano para iniciar a **Fase 1** (migration + UI completa de Solicitação → Aprovação → Pedido → integração com Contas a Pagar + Fornecedores + Dashboard básico).
