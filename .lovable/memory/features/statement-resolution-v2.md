---
name: Statement Resolution v2
description: Extrato bancário imutável + criar lançamento + transferências internas + estornos no painel de resolução
type: feature
---
**Princípio:** extrato é a verdade realizada e imutável; toda linha vira um destino sem duplicidade.

**Painel `StatementResolutionPanel`** por linha: `[Vincular] [Criar] [⋯ Transferência | Estorno | Complementar | Descartar]`.

**RPCs (todas SECURITY DEFINER + audit_log):**
- `resolve_correct_and_retry` — bloqueia alterar `data`/`valor` quando o parser já entregou valores válidos (registra tentativa em audit_log como `imutabilidade_extrato_recusada`).
- `resolve_create_cashflow(staging, descricao, account, cc, entity, contract, categoria, notes)` — cria `cashflow_entries` `pago/recebido` + BSE conciliada, source=`extrato_bancario`, source_ref=`staging:<id>`.
- `resolve_mark_as_transfer(staging, counterparty?, descricao?)` — cria `internal_transfers` (status `aguardando_contraparte` ou `completa`) + 1-2 legs `categoria='transferencia_interna'` com `transfer_id`.
- `resolve_mark_as_reversal(staging, original_entry, notes?)` — cria leg com `is_estorno=true`, `estorno_de_entry_id`; marca original com `estornado_em`/`estornado_por_entry_id`. Unique index `cashflow_estorno_unique_per_original` impede 2º estorno.
- `search_transfer_counterparties(staging, ±days)` e `search_reversal_candidates(staging, days)` — match por valor oposto + janela temporal.

**Schema:**
- `internal_transfers` (org, from/to bank account + cashflow_entry + bse, valor, data, status).
- `cashflow_entries` ganhou `transfer_id`, `is_estorno`, `estorno_de_entry_id`, `estornado_em`, `estornado_por_entry_id`.
- `bank_statement_staging.status` aceita `vinculado_parcial`.

**KPI (useFinanceiro.totals):** ignora `categoria='transferencia_interna'`; estornos subtraem do `total_previsto` e `total_realizado` (líquido após anulação).

**Guard:** todas as escritas para `pago/recebido` fazem `set_config('app.allow_realize','on',true)` antes — respeita `cashflow_realize_guard`.
