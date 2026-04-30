# Análise & Plano — Módulo Financeiro

Posiciono o módulo como **hub centralizador**: ingestão por importação + webhooks de ERPs, com motor próprio de classificação, conciliação e governança. Não é bookkeeping; é cockpit auditável.

## Diagnóstico por aba

### 1. Contas a Pagar / Contas a Receber

- KPIs do `useFinanceiro.totals` somam **previsto + realizado**, gerando dupla contagem em parcelas pagas (a paga ainda entra em `total_previsto`).
- Geração de parcelas (`create`) usa `Math.round((valor/n)*100)/100` — última parcela não recebe o resíduo, gerando diferença de centavos.
- `data_prevista`, `data_vencimento`, `data_prevista_pagamento` são 3 campos sobrepostos com regras implícitas — fonte recorrente de bug.
- AR não tem painel de pendências/triagem nem botão de importar de webhook (CA Pagar tem `PendenciasPanel`, `ExpenseRequestButton`).
- Status livre em `text` (sem enum) → "paga"/"pago", "pendente"/"previsto" coexistem.

### 2. Aging List

- Buckets corretos, mas `differenceInDays` recalculado a cada render (today novo a cada chamada → invalida memos).
- Faltam **filtros** (empresa, fornecedor, faixa de valor) e **ações em lote** (marcar pago, lançar transferência).
- Auditoria saldo×conciliados foi adicionada; precisa virar **card destacado** no topo quando divergência > X%.
- Posição de caixa por empresa abre Dialog — bom; falta **drill-down por conta** dentro do Dialog.

### 3. Fluxo de Caixa

- KPIs do "Realizado" usam `valor_realizado ?? valor_previsto` — quando o pago veio com valor menor, o card mistura previsto+realizado para o mesmo registro nas outras subabas.
- Sem **saldo acumulado** (running balance) por dia/mês — peça-chave para CFO ver runway.
- Sem comparativo Previsto vs Realizado nem variação MoM.
- Não há export (CSV/PDF) do fluxo.

### 4. Conciliação

- Algoritmo de match (`match_statement_to_cashflow` RPC) usa ±10% e ±7d; precisa **sugerir múltiplos** com peso de descrição (não só valor+data).
- Sem **conciliação em lote** (auto-match score > 95%).
- Sem **regras persistidas** ("descrição X sempre vai para conta Y") — toda conciliação é manual.
- Falta visão de **divergências saldo banco vs livro** (já calculado no Aging — duplicar/centralizar aqui).
- Sem mecanismo de import de arquivo OFX 

### 5. Contas Bancárias

- 683 linhas em um componente, vários Dialogs inline — refatorar em subcomponentes.
- Saldo manual é "fonte da verdade" (memória), mas não há **histórico de saldos** (snapshots) para auditoria temporal.
- Cheque especial bem modelado, mas sem **alerta proativo** quando consumo > 70% do limite.
- Gestão de limites de crédito e capital de giro confusa

### 6. Importações

- Bom: histórico, períodos fiscais, undo. Faltam:
  - **Detecção de duplicatas pré-import** (já existe `useDuplicateDetection` mas só pós-import).
  - **Templates salvos** por ERP (Omie, Conta Azul, Bling, etc.) para mapeamento 1-clique.
  - **Agendamento de import recorrente** (drop em pasta / endpoint).
- Hoje **não há ingestão por webhook** — gap principal vs. visão de hub.

### 7. Transversal

- `cashflow_entries.status` e `tipo` em `text` → criar enums.
- `conciliacao_id` é `text` (deveria ser uuid).
- Sem **trilha de auditoria** (`cashflow_audit_log`) — quem mudou valor, quando.
- 1356 lançamentos pagos **sem conta bancária** vinculada — distorce a auditoria de saldo.
- Sem rate limit / validação Zod nas Edge Functions de import.

---

## Plano de melhorias (4 fases)

### Fase 1 — Correções de cálculo & integridade (quick wins)

1. **Totais corretos em `useFinanceiro**`: separar `previsto_pendente` (só status previsto/confirmado) de `realizado` (só pago/recebido). Eliminar dupla contagem.
2. **Parcelamento sem resíduo**: última parcela recebe `valor - sum(parcelas anteriores)`.
3. **Unificar datas**: usar `data_vencimento` como única fonte; `data_prevista` é derivada (= vencimento se vazio). Migration backfill.
4. **Backfill `conta_bancaria_id**` nos 1356 lançamentos pagos: tentar via conciliação; restantes ficam em "Conta indefinida" sinalizada.
5. **Enums Postgres** para `cashflow_entries.status` e `tipo` (com migration de normalização).
6. **Tabela `cashflow_audit_log**` + trigger AFTER UPDATE/DELETE em `cashflow_entries`.

### Fase 2 — Conciliação & governança

7. **Tabela `reconciliation_rules**` (org_id, padrão_descricao regex, account_id, cost_center_id, entity_id, conta_bancaria_id) aplicada automaticamente no import e na conciliação.
8. **Auto-match em lote** na aba Conciliação: botão "Conciliar automaticamente score ≥ 95%" + log do que casou.
9. **RPC `match_statement_to_cashflow` v2**: pesos = 50% valor, 30% data, 20% similaridade descrição (Jaro-Winkler).
10. **Card "Divergência de saldo"** no topo do Aging quando |saldo_atual - reconciled| > 1% por conta.
11. **Snapshot diário de saldos** (`bank_balance_snapshots`) via cron pg_cron — base para gráfico runway.

### Fase 3 — Hub: webhooks + ingestão

12. **Tabela `integration_endpoints**` (org_id, provider, secret_hash, target='cashflow_entry'|'bank_statement'|'invoice', mapping_template).
13. **Edge Function `webhook-ingest**` pública, autenticada por secret no header, com validação Zod, idempotência por `external_id`, gravação em `data_imports` + materialização opcional. Suporte para Omie/Conta Azul/Bling/genérico JSON.
14. **Página "Integrações" dentro do Financeiro** (nova aba): listar endpoints, copiar URL+secret, ver últimas 50 chamadas, status, últimos erros.
15. **Templates de mapeamento por ERP** salvos (`import_templates`) — escolhe-se no ImportDialog para pular o passo de mapeamento.
16. **Detecção de duplicata pré-import** no preview do `ImportDialog`, usando `dedup_hash` + `useDuplicateDetection`.

### Fase 4 — UX & cockpit CFO

17. **Fluxo de Caixa: saldo acumulado** (linha + área) com previsto vs realizado e marca de runway (saldo zero).
18. **Filtros globais no Financeiro** (empresa, período, conta bancária, centro de custo) persistidos em URL.
19. **Refator `ContasBancariasTab**` em 4 subcomponentes (lista, dialog saldo, dialog limite, dialog PIX).
20. **AR ganha PendenciasPanel** equivalente ao do AP (cobrança/baixa de recebíveis projetados).
21. **Padronizar nº contábil**: aplicar `fmtAcc` (negativos em parênteses + vermelho) em todas as tabelas do módulo (FluxoCaixa, Conciliação, ContasBancárias).
22. **Export CSV/PDF** do Fluxo de Caixa (mesma lib do PDF de posição de caixa).

---

## Estrutura técnica

```text
supabase/migrations/
  - cashflow_status_enum.sql            (Fase 1)
  - cashflow_audit_log.sql              (Fase 1)
  - reconciliation_rules.sql            (Fase 2)
  - bank_balance_snapshots.sql          (Fase 2)
  - integration_endpoints.sql           (Fase 3)
  - import_templates.sql                (Fase 3)

supabase/functions/
  - webhook-ingest/index.ts             (Fase 3, novo)
  - reconcile-auto/index.ts             (Fase 2, novo)
  - bank-balance-snapshot/index.ts      (Fase 2, cron)

src/components/financeiro/
  - IntegrationsTab.tsx                 (Fase 3, novo)
  - ReconciliationRulesDialog.tsx       (Fase 2, novo)
  - BalanceDivergenceCard.tsx           (Fase 2, novo)
  - BalanceHistoryChart.tsx             (Fase 4, novo)
  - bank/{BankAccountList,BalanceDialog,LimitDialog,PixDialog}.tsx  (Fase 4, refactor)

src/hooks/
  - useFinanceiro.ts                    (Fase 1, fix totals + parcelas)
  - useReconciliationRules.ts           (Fase 2, novo)
  - useBankBalanceHistory.ts            (Fase 2, novo)
  - useIntegrationEndpoints.ts          (Fase 3, novo)

src/lib/
  - financialMath.ts                    (Fase 1, novo — splitInstallments, accBalance)
```

## Impactos & cuidados

- Mudanças de schema (enums) exigem normalização prévia de dados existentes — incluído em cada migration.
- Webhook público requer rate limit (in-memory por org+IP) + secret rotacionável + log de auditoria.
- Backfill de `conta_bancaria_id` tem risco de associar errado: marcar `notes` com prefixo `[backfill-auto]` para reversão.
- Audit log infla rapidamente — incluir TTL/partição por mês.

## Fora de escopo (futuro)

- Emissão fiscal (NFe/NFSe).
- Conciliação Open Finance via Belvo/Pluggy.
- Multi-moeda.
- Razão contábil completo (DRE/Balanço já existem em outro módulo; aqui só feed).

Aprovando este plano, executo em ordem (Fase 1 → 4) com confirmação no final de cada fase.