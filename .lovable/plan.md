
# Revisão das integrações do módulo Compras

Mapeei o que já existe nas Fases 1–3 e identifiquei lacunas em cada cruzamento com os demais módulos do cockpit financeiro. Abaixo: estado atual → gap → melhoria proposta.

---

## 1. Mapa atual de integrações

```text
                ┌──────────────────────┐
                │   COMPRAS (core)     │
                │ requests/orders/...  │
                └──────────┬───────────┘
   cashflow_entries ◄──────┤  trg_po_to_cashflow (AP projetado)
   contracts        ◄──────┤  fn_po_after_confirm (software_saas)
   it_equipment     ◄──────┤  fn_po_after_confirm (ativo_imobilizado)
   notifications    ◄──────┤  trg_notify_approval_pending / divergence_open
   purchase_audit   ◄──────┤  trg_pq_audit / trg_pr_audit
   suppliers        ◄──────┤  FK + fornecedor dedicado
   contracts (FK)   ──────►│  request.contract_id / order.contract_id
   check_purchase_budget   │  consulta planejamento (planned vs realizado)
                ▲
                │  (faltando) DP, CRM, Estoque, Tarefas, DRE, Fiscal
```

**Já cobre bem:** Financeiro AP (cashflow), Contratos (SaaS), TI (ativo imobilizado), Notificações, Auditoria, Orçamento (planned).

**Lacunas relevantes:** integração com Tarefas/Workflow, DP (compras de benefícios/treinamento), CRM (compras vinculadas a oportunidade/projeto), Estoque/Almoxarifado, Centro de Custo + DRE, Fiscal (NF-e), Holding/multi-empresa, Realtime.

---

## 2. Gaps por módulo e melhorias

### 2.1 Financeiro (AP / Cashflow / Reconciliação)
- ✅ `trg_po_to_cashflow` já cria entrada projetada idempotente em `cashflow_entries` (source=`compras`).
- ⚠️ **Gap:** ao receber NF (`purchase_receipts.nf_*`), o valor projetado **não é re-tipado** para "a pagar realizado" (princípio MECE de materialização).
- ⚠️ **Gap:** divergência de preço resolvida não ajusta valor em `cashflow_entries`.
- ⚠️ **Gap:** rateio por centro de custo (`financial-cost-center-prorating`) não é propagado do pedido para o lançamento financeiro.
- 🔧 **Melhoria:** trigger `fn_pr_materialize_cashflow` quando recebimento status=`total` → atualiza entry para `realizado`, valor da NF, vencimento conforme `condicao_pagamento`. Idempotente via `source_ref = 'po:<id>'`.
- 🔧 **Melhoria:** propagar `cost_center_allocations` (rateio 100%) do PO para o cashflow_entry.
- 🔧 **Melhoria:** retenções (IRRF/INSS/ISS/PIS/COFINS) calculadas e gravadas no entry quando tipo=`servico`.

### 2.2 Contratos
- ✅ FK `contract_id` em request e order; auto-criação para `software_saas`.
- ⚠️ **Gap:** `manutencao` recorrente, `obra` e `servico` recorrente não geram contrato.
- ⚠️ **Gap:** quando há contrato existente, pedido **não consome** parcelas de `contract_installments` (pode duplicar projeção).
- 🔧 **Melhoria:** ampliar `fn_po_after_confirm` para cobrir `manutencao`/`servico` recorrente.
- 🔧 **Melhoria:** se `purchase_orders.contract_id` preenchido, pular `trg_po_to_cashflow` (a parcela do contrato já projeta) — respeitar [Materialization MECE](mem://logic/financeiro-materialization-mece).
- 🔧 **Melhoria:** botão "Vincular a contrato existente" na `OrdersTab`.

### 2.3 TI (Patrimônio)
- ✅ Cria `it_equipment` com depreciação 60/48m para `ativo_imobilizado`.
- ⚠️ **Gap:** não respeita o wizard TI ([TI Equipment Wizard](mem://features/ti-equipment-wizard)) — gera equipamento "cru" sem tipo/specs/atribuição.
- ⚠️ **Gap:** sem geração de tarefa semestral de revisão de substituição.
- 🔧 **Melhoria:** após criar equipamento, abrir tarefa de "Completar cadastro TI" via `request_tasks`, com link para o wizard.
- 🔧 **Melhoria:** pedidos do tipo `ativo_imobilizado` exigirem campos mínimos (tipo TI, specs jsonb) já no item do PO.

### 2.4 DP (RH)
- ❌ **Gap total:** nenhum link com DP. Compras de benefícios (VR/VA/Saúde), uniformes, treinamentos e equipamentos para colaboradores não enxergam `employees`.
- 🔧 **Melhoria:** novo tipo `beneficio_colaborador` + FK opcional `employee_id` no item; integração com `employee_benefits` para custo unitário plano de saúde.
- 🔧 **Melhoria:** compras de treinamento criar evento em `dp_routine_tasks` para acompanhamento.

### 2.5 CRM Comercial
- ❌ **Gap total:** sem vínculo com `crm_opportunities`/`crm_deals`. Compras destinadas a entregar uma venda (custo direto) não rastreiam margem.
- 🔧 **Melhoria:** FK opcional `opportunity_id` em `purchase_requests`; relatório de margem por oportunidade (receita CRM − custo Compras).

### 2.6 Estoque / Almoxarifado
- ❌ **Gap:** não existe entidade de estoque. Itens recebidos não atualizam saldo.
- 🔧 **Melhoria (futura):** tabela `inventory_items` + `inventory_movements`, recebimentos do tipo `produto`/`consumo` geram entrada (kardex). Por ora, só sinalizar para evitar contagem dupla no cashflow.

### 2.7 Centro de Custo / DRE
- ✅ `purchase_requests.cost_center_id` existe.
- ⚠️ **Gap:** não usa rateio multi-CC; não força conta contábil (4 níveis) no item.
- 🔧 **Melhoria:** RPC `suggest_account_for_purchase(tipo, descricao)` usando o motor [Chart Automation](mem://features/chart-of-accounts-automation).
- 🔧 **Melhoria:** validação de período fiscal aberto ([Governance Periods](mem://features/financial-governance-periods)) ao confirmar pedido.

### 2.8 Fiscal / NF-e
- ⚠️ Recebimento captura `nf_numero`, `nf_chave`, `nf_valor` mas não valida.
- 🔧 **Melhoria:** edge function `validate_nfe_chave` (DV módulo 11); futura ingestão XML via `etl_pipeline_core`.
- 🔧 **Melhoria:** divergência automática se `nf_valor ≠ Σ items.valor_total` ou `nf_cnpj ≠ supplier.cnpj`.

### 2.9 Tarefas & Workflow ([Task Workflow](mem://features/task-management-workflow))
- ⚠️ Compras emite `notifications` mas não cria `request_tasks`.
- 🔧 **Melhoria:** ao gerar PO, criar tarefa "Confirmar recebimento até <data_prevista>" para responsável; ao abrir divergência, criar tarefa "Resolver divergência".

### 2.10 Holding / Multi-empresa
- ⚠️ Tudo escopado por `organization_id` (correto), mas não há **compra centralizada** para várias filiais (rateio entre subsidiárias da Holding).
- 🔧 **Melhoria:** opção "Pedido consolidado da Holding" com rateio para `subsidiary_ids[]` — gera N entries em cashflow proporcionais.

### 2.11 Realtime + Snapshot Cache
- ⚠️ `purchase_*` não estão em `supabase_realtime` nem disparam `bump_org_data_version` para Dashboard.
- ✅ `bump_org_data_version` já está em `purchase_requests` e `purchase_orders` (verificado).
- 🔧 **Melhoria:** adicionar `purchase_orders`, `purchase_receipts`, `purchase_divergences` à publicação realtime para a `OrdersTab`/`DivergencesTab` se atualizarem ao vivo.

### 2.12 Backoffice / Permissões
- ⚠️ Sem mapeamento explícito de `purchase.*` em `MODULE_DEFINITIONS` granular (aprovador, comprador, recebedor, financeiro).
- 🔧 **Melhoria:** roles `compras_solicitante`, `compras_aprovador`, `compras_comprador`, `compras_recebedor` + RLS por papel.

### 2.13 Auditoria & LGPD
- ✅ `purchase_audit_log` para quotations/receipts.
- ⚠️ **Gap:** requests, orders e divergences não logam diff completo.
- 🔧 **Melhoria:** generalizar trigger `fn_purchase_audit` para todas as tabelas, gravando `before/after` jsonb.

### 2.14 IA & Sugestões
- ❌ Sem uso de Lovable AI.
- 🔧 **Melhoria (Fase 4):** edge function `compras-ai-suggest` (model: `google/gemini-2.5-flash`):
  - sugerir conta contábil + centro de custo a partir da descrição;
  - resumir comparativo de cotações (preço × prazo × condição);
  - detectar anomalias (preço acima da média histórica do fornecedor).

---

## 3. Plano de melhorias em ondas

### Onda A — Integridade financeira (alta prioridade)
1. Materialização MECE: trigger receipt → atualiza cashflow (realizado) e respeita contract_id.
2. Rateio multi-centro de custo do PO para cashflow.
3. Cálculo de retenções tributárias para serviços.
4. Validação de período fiscal e de DV da chave NF-e.

### Onda B — Workflow e UX operacional
5. Criação automática de `request_tasks` (confirmar recebimento, resolver divergência).
6. Divergência automática quando NF ≠ pedido (valor/CNPJ).
7. Realtime nas abas Pedidos/Recebimentos/Divergências.
8. Wizard "Completar cadastro TI" pós-criação de equipamento.

### Onda C — Conexões ampliadas
9. FK opcional `opportunity_id` (CRM) e `employee_id` no item (DP).
10. Tipo `beneficio_colaborador` + integração com `employee_benefits`.
11. Pedido consolidado da Holding com rateio entre subsidiárias.
12. Roles granulares (`compras_*`) + RLS.

### Onda D — Inteligência e fiscal avançado
13. Edge function `compras-ai-suggest` (classificação + anomalias + resumo cotações).
14. ETL ingestão XML NF-e via `etl_pipeline_core`.
15. (Opcional) Estoque/almoxarifado básico (kardex).

---

## 4. Detalhes técnicos relevantes

- **Idempotência:** todas as novas materializações devem usar chave estável (`source='compras'`, `source_ref='po:<id>'` / `receipt:<id>'`) para suportar reprocessamento sem duplicar — alinhado a [Materialization MECE](mem://logic/financeiro-materialization-mece) e [MECE Philosophy](mem://logic/mece-integrity-philosophy).
- **Cache:** invalidar `dashboard_snapshots` via `bump_org_data_version` em `purchase_receipts` e `purchase_divergences` (ainda não cobertos).
- **Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders, public.purchase_receipts, public.purchase_divergences;`.
- **Segurança:** novos campos `employee_id` e `opportunity_id` precisam de cross-table RLS ([Cross Table RLS](mem://security/cross-table-rls-validation)).
- **AI:** usar `LOVABLE_API_KEY` já provisionada; nada de novo segredo.

---

## 5. O que NÃO entra agora
- Substituir contratos pelo módulo de compras (responsabilidades distintas).
- Estoque completo com lotes/validade (escopo de Fase 5+).
- Integração com bancos (boleto/Pix de fornecedor) — fica para módulo Financeiro AP.

Após aprovação, sugiro começar pela **Onda A** porque endereça os riscos de duplicação financeira (MECE) e fecha o ciclo "PO → Recebimento → AP realizado → DRE".

---

## 6. ✅ Onda A — IMPLEMENTADA

**Migration:** `20260511_compras_onda_a.sql`

- `purchase_receipts`: novos campos `nf_chave`, `nf_cnpj`, `nf_valor`.
- `purchase_orders` + `cashflow_entries`: `cost_center_allocations` (jsonb, validado 100%) e `tax_retentions` (jsonb).
- Função `validate_nfe_chave(text)` — DV módulo 11 dos 44 dígitos.
- Função `compute_purchase_tax_retentions(tipo, valor)` — IRRF 1,5% / INSS 11% / ISS 5% / PIS 0,65% / COFINS 3% / CSLL 1% para serviço/manutenção/obra.
- Trigger `trg_pr_validate_nf` — abre divergência automática quando chave inválida, CNPJ ≠ fornecedor ou valor da NF ≠ pedido.
- Trigger `trg_pr_materialize_cashflow` — quando recebimento fica `total`, atualiza o lançamento provisório para `a_pagar` com valor da NF, vencimento por `condicao_pagamento` (regex de dias), competência, retenções e rateio. Idempotente via `source_ref = purchase_order:<id>`.
- `purchase_order_to_cashflow` agora **ignora pedidos com `contract_id`** (parcela do contrato é a fonte da verdade — MECE).
- Trigger `trg_po_check_fiscal_period` — bloqueia confirmação/envio de PO em competência fechada.
- Auditoria de cotações/recebimentos corrigida (colunas `entity_type/entity_id/action/new_value`).
- Realtime + REPLICA IDENTITY FULL para `purchase_receipts`, `purchase_divergences`, `purchase_quotations`.
- `bump_org_data_version` em `purchase_receipts` e `purchase_divergences` → invalida `dashboard_snapshots`.

**Frontend:** `ReceiptsTab` ganhou inputs de Chave NF-e, CNPJ emissor e valor total da NF.

**Próximo:** Onda B (tarefas automáticas, divergência sobre NF, realtime nas abas, wizard TI).
