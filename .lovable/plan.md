
# Onda B — Workflow operacional do módulo Compras

Objetivo: tirar o módulo de Compras do "registro manual" e plugá-lo no fluxo vivo de tarefas, notificações em tempo real e cadastro completo de ativos TI. Tudo em cima do que a Onda A já entregou (materialização MECE, validação NF-e, retenções, rateio).

---

## 1. Tarefas automáticas no workflow (`request_tasks`)

Hoje Compras só dispara `notifications`. Vamos passar a criar tarefas reais, rastreáveis em /tarefas.

**Triggers a criar:**

- `trg_po_create_receipt_task` — ao confirmar um `purchase_order` (`status='confirmado'`):
  - cria `request_tasks` "Confirmar recebimento de <fornecedor> — pedido #<numero>"
  - `due_date` = `data_entrega_prevista` (ou `created_at + 7 dias`)
  - `assigned_to` = `recebedor_id` do PO (fallback: solicitante)
  - `source='compras'`, `source_ref='po:<id>'` para idempotência

- `trg_divergence_create_task` — ao inserir `purchase_divergences` com `status='aberta'`:
  - cria tarefa "Resolver divergência <tipo> — pedido #<numero>"
  - `priority` derivada de `severity` (high→alta, medium→média)
  - `assigned_to` = comprador do PO
  - `source_ref='divergence:<id>'`

- `trg_divergence_close_task` — ao fechar divergência (`status='resolvida'`), marca a tarefa relacionada como `concluida`.

**Sem duplicação:** `ON CONFLICT (source, source_ref) DO NOTHING` em `request_tasks` (precisa do índice único).

---

## 2. Realtime nas abas operacionais

Atualmente só `cashflow_entries`/`contracts`/`request_tasks` estão na publicação. Vamos adicionar:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.purchase_orders,
  public.purchase_receipts,
  public.purchase_divergences,
  public.purchase_quotations;

ALTER TABLE public.purchase_orders        REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_receipts      REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_divergences   REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_quotations    REPLICA IDENTITY FULL;
```

(Onda A já adicionou receipts/divergences/quotations — confirmar e completar com `purchase_orders`.)

**Frontend:** adicionar `useRealtimeSync` em `src/pages/Compras.tsx`:

```ts
useRealtimeSync([
  { table: "purchase_orders",      invalidateKeys: [["compras","orders"], ["dashboard-snapshot"]] },
  { table: "purchase_receipts",    invalidateKeys: [["compras","receipts"], ["compras","divergences"]] },
  { table: "purchase_divergences", invalidateKeys: [["compras","divergences"], ["compras","dashboard"]] },
  { table: "purchase_quotations",  invalidateKeys: [["compras","quotations"]] },
]);
```

E garantir que as queries em `useCompras` usem essas keys.

---

## 3. Wizard "Completar cadastro TI" pós-recebimento de ativo

Hoje o `fn_po_after_confirm` cria um `it_equipment` cru para `ativo_imobilizado`. Vamos transformar isso em um fluxo guiado:

- Trigger atualizado: ao criar `it_equipment` originado de Compras, marcar `pending_wizard=true` (nova coluna boolean, default false).
- Criar `request_tasks` "Completar cadastro TI: <equipamento>" com `link_url='/ti?equipment=<id>&wizard=open'`, `assigned_to` = responsável TI (de `system_settings.it_responsible_user_id` ou fallback admin).
- No `/ti`, ao abrir com `?wizard=open&equipment=<id>`, montar automaticamente o [TI Equipment Wizard](mem://features/ti-equipment-wizard) em **modo "completar existente"**, pré-preenchido com fornecedor, valor, data — usuário só preenche tipo/specs/atribuição.
- Ao concluir o wizard, `pending_wizard=false` e a tarefa é fechada.

---

## 4. Divergência automática refinada sobre NF

Onda A já gera divergência quando: chave NF-e inválida, CNPJ ≠ fornecedor, valor da NF ≠ pedido. Onda B amplia:

- **Quantidade recebida ≠ pedida** por item → divergência `tipo='quantidade'`.
- **Data de emissão da NF posterior à entrega** → divergência `tipo='prazo'` severity=low.
- **Fornecedor sem cadastro fiscal completo** (sem CNPJ ou IE) ao receber NF → divergência `tipo='cadastro'` apontando para o fornecedor.

Tudo no mesmo `trg_pr_validate_nf` estendido, idempotente por `(receipt_id, tipo)`.

---

## 5. UX nas abas

- **OrdersTab:** badge "🔴 X divergências" e "📋 tarefa pendente" por linha (join leve via hook).
- **DivergencesTab:** botão "Resolver" agora também fecha a tarefa associada (já automático via trigger).
- **ReceiptsTab:** após salvar com NF, toast "Validação fiscal OK" ou "Divergência aberta automaticamente — ver aba Divergências".
- **ComprasDashboard:** novo card "Tarefas de Compras pendentes" (count de `request_tasks` com `source='compras'` e `status<>'concluida'`).

---

## 6. Arquivos afetados

```text
supabase/migrations/<ts>_compras_onda_b.sql      ← novo
src/pages/Compras.tsx                            ← useRealtimeSync
src/hooks/useCompras.ts                          ← keys consistentes + count tasks
src/components/compras/OrdersTab.tsx             ← badges divergência/tarefa
src/components/compras/DivergencesTab.tsx        ← UX/feedback
src/components/compras/ReceiptsTab.tsx           ← toast pós-validação
src/components/compras/ComprasDashboard.tsx      ← card tarefas
src/pages/TI.tsx                                 ← suporte ?wizard=open&equipment=
src/components/ti/EquipmentWizard.tsx (existente) ← modo "completar existente"
.lovable/plan.md                                 ← registrar Onda B
mem://features/compras-mece-integration          ← atualizar com Onda B
```

---

## 7. Não entra agora (fica para Onda C/D)

- `employee_id`/`opportunity_id` (DP/CRM) — Onda C
- Pedido consolidado da Holding — Onda C
- Roles granulares `compras_*` — Onda C
- IA de sugestão / ETL XML NF-e — Onda D

---

## 8. Critérios de pronto

- Confirmar um PO cria automaticamente a tarefa de recebimento em /tarefas.
- Receber NF com CNPJ errado abre divergência **e** tarefa "Resolver divergência" sem ação manual.
- Outra aba aberta vê o pedido mudar de status sem F5.
- Comprar um notebook gera tarefa "Completar cadastro TI" que leva direto ao wizard pré-preenchido.
- Nenhuma duplicação de tarefa em re-execuções (idempotência por `source_ref`).
