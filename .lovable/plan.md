# Reformulação MECE do Módulo Financeiro

## Diagnóstico atual

Hoje o sistema confunde **"intenção de pagar"** com **"pagamento efetivo"**:

- `Contas a Pagar` tem botão "Marcar como pago" (`markAsPaid`) que **já grava** `status='pago'`, `valor_realizado` e `data_realizada` — sem nenhuma confirmação no extrato.
- `Conciliação` também marca como `pago/recebido` ao vincular extrato. Resultado: dois caminhos diferentes geram o mesmo estado, quebrando MECE (um lançamento pode estar "pago" sem nunca ter saído do banco).
- `Fechamento de mês` (`fiscal_periods`) existe, mas pode ser fechado mesmo com lançamentos previstos sem conciliação e linhas de extrato pendentes.
- Solicitações de outros departamentos já caem corretamente em `previsto` via `ApproveRequestDialog`, mas depois seguem o mesmo fluxo ambíguo.

## Princípio MECE alvo

Toda movimentação financeira deve estar **em exatamente um** de três estados:

```text
PREVISTO              EM PAGAMENTO                 REALIZADO
(planejamento)   →    (ação registrada,       →   (confirmado
                       aguardando banco)           pelo extrato)
```

Regra dura: **só a conciliação bancária promove para REALIZADO**. Nenhum botão de outro módulo pode gravar `valor_realizado` / `data_realizada` / `status='pago|recebido'` diretamente.

## Mudanças por área

### 1. Modelo de dados (migration)

Adicionar a `cashflow_entries`:
- `status` ganha dois novos valores: `pagamento_emitido` (saída) e `recebimento_esperado` (entrada).
- `data_pagamento_emitido date`, `pagamento_emitido_por uuid`, `pagamento_emitido_em timestamptz`, `pagamento_meio text` (pix/ted/boleto/cartao).
- Trigger `cashflow_entries_status_guard`: bloqueia transições para `pago`/`recebido` se a linha não tiver `bank_statement_entry_id` vinculado (exceções: import histórico marcado com `source='import_historico'`).
- Trigger `cashflow_entries_realized_fields`: `valor_realizado` e `data_realizada` só podem ser escritos a partir do fluxo de conciliação (RPC), nunca via update direto.

Estado de `fiscal_periods`:
- Nova coluna `fechamento_checklist jsonb` (snapshot do que foi validado).
- RPC `close_fiscal_period(p_org, p_year_month)` — só aceita fechar quando:
  1. 0 linhas em `bank_statement_entries` com `status='pendente'` no período;
  2. 0 linhas em `bank_statement_staging` com `status='pendente'`;
  3. 100% dos `cashflow_entries` com `data_vencimento` dentro do mês e `impacto_fluxo_caixa=true` estão em `pago`/`recebido` ou justificados (`status='cancelado'` com motivo).
- RPC `get_month_closing_readiness(p_org, p_year_month)` retorna percentuais por bloco para o cabeçalho.

### 2. Contas a Pagar / Receber

- Renomear ação "Marcar como pago" para **"Registrar pagamento emitido"** (saída) e **"Registrar recebimento esperado"** (entrada).
- Esta ação grava apenas: `status='pagamento_emitido'`, `data_pagamento_emitido`, `pagamento_meio`, `pagamento_emitido_por`. **Não** toca `valor_realizado` nem `data_realizada`.
- Novo chip de status na tabela: `Previsto` (azul) · `Em pagamento` (âmbar) · `Pago/Recebido` (verde) · `Cancelado` (cinza).
- Novo filtro/aba "Em pagamento aguardando extrato" mostrando idade do registro (alerta se >3 dias úteis sem conciliação).
- Botão "Desfazer pagamento emitido" disponível enquanto não conciliado.
- `ValorExecutadoDialog` deixa de ser confirmação final — vira apenas a tela de "registro de emissão" (mantém data, mas sem campo `valor_realizado`).

### 3. Conciliação

- Continua sendo o **único** caminho que promove para `pago`/`recebido`.
- Ao conciliar uma linha de extrato com um cashflow `pagamento_emitido` ou `recebimento_esperado`: confirma e fecha o ciclo.
- Ao conciliar com um `previsto` que pulou a etapa intermediária: aceita, mas registra `pulou_emissao=true` no `cashflow_audit_log` para evidência.
- Ao conciliar com um lançamento ainda inexistente: o fluxo de "Resolver Extrato" (já implementado) cria direto como `realizado`, mantendo MECE.

### 4. Solicitações de outros departamentos

- Fluxo permanece: `solicitada → aprovada` → cria `cashflow_entries` com `status='previsto'`. ✓
- **Bloqueio novo (trigger)**: `requests` não pode ser marcada como `executada` se o `cashflow_entry_id` referenciado não estiver `pago/recebido` (i.e. conciliado).
- Notificação ao solicitante muda de "Aprovada" para "Aprovada — aguardando pagamento" e depois "Paga — confirmada no extrato".

### 5. Cabeçalho do Financeiro — Termômetro de fechamento

Componente `MonthClosingReadinessCard` no topo de `Financeiro.tsx`:

```text
Maio/2026 — Pronto para fechar: 78%
[ 92% conciliação extrato ] [ 71% AP liquidado ] [ 80% AR liquidado ]
[ Fechar mês ]  (desabilitado até 100%)
```

Ao chegar em 100%, botão `Fechar mês` chama a RPC e bloqueia escrita no período (já existe a infra de `fiscal_periods`).

### 6. Aging List e Dashboards

- `AgingListTab` ganha coluna "Estado de pagamento" (Previsto/Em pagamento/Pago).
- Card "Em pagamento aguardando extrato" no dashboard com drill-down.
- KPIs do `ContasAPagar`: separar `Total previsto` · `Em pagamento` · `Pago` (hoje só tem previsto/pago).

## Arquivos afetados

**Migration nova** (estados + triggers + RPCs `close_fiscal_period` / `get_month_closing_readiness`).

**Backend lógico**: `src/hooks/useFinanceiro.ts` (split de `markAsPaid` em `registerPaymentIssued` + nova `confirmRealization` interna usada só pela conciliação), `src/hooks/useConciliacao.ts`, `src/hooks/useFiscalPeriods.ts`, `src/hooks/useStatementResolution.ts`.

**UI**: `ContasAPagar.tsx`, `ContasAReceber.tsx`, `ValorExecutadoDialog.tsx` (renomear/refazer), `FinanceiroTable.tsx` (chips e filtros), `ConciliacaoTab.tsx` (badge "fecha pagamento emitido"), novo `MonthClosingReadinessCard.tsx`, `AgingListTab.tsx`, `PendenciasPanel.tsx`.

**Memória do projeto**: registrar a nova regra dos 3 estados em `mem://logic/financeiro-mece-3-states` e atualizar o índice.

## Migração de dados existentes

- Cashflow com `status='pago'` E `bank_statement_entry_id IS NULL` → reclassificar como `pagamento_emitido` (e `recebido` → `recebimento_esperado`), preservando `valor_realizado` em campo de auditoria, para que o usuário possa concluir a conciliação retroativamente. Linhas vinculadas ao extrato permanecem `pago/recebido`.

## Resultado esperado

Toda linha do sistema cabe em exatamente um balde MECE. Fechar o mês deixa de ser ato de fé: passa a ser uma consequência matemática de **AP + AR + Extrato 100% conciliados**.
