---
name: Financeiro Hub Roadmap
description: Plano em 4 fases para tornar o módulo Financeiro um hub centralizador (importações + webhooks) substituível a ERP. Fases 1 e 2 implementadas.
type: feature
---

# Financeiro como Hub Centralizador

Visão: o Financeiro NÃO é bookkeeping. É cockpit auditável que ingere dados de outros ERPs (importação CSV/XLSX + webhooks) e centraliza decisões.

## Fase 1 — Implementada
- `src/lib/financialMath.ts` — `splitInstallments` (última parcela absorve resíduo), `round2`, `prorateByPercent`, `runningBalance`.
- `useFinanceiro.totals` corrigido: cada lançamento conta em UM bucket (pendente OU realizado), sem dupla contagem.
- Tabela `cashflow_audit_log` + trigger `trg_cashflow_audit` (AFTER UPDATE/DELETE) registra mudanças sensíveis (valor, data, status, conta, entity, account, cost center).
- Índice `idx_cashflow_org_account_status` acelera auditoria saldo×conciliados.
- Backfill: lançamentos pagos sem `conta_bancaria_id` marcados em `notes` com `[backfill-pendente]`.

## Fase 2 — Implementada
- Extensão `pg_trgm` habilitada + índice GIN `idx_cashflow_descricao_trgm`.
- Tabela `reconciliation_rules` (org-scoped, RLS): padrão de descrição (contains/regex/exact), tipo, account/cost_center/entity/conta_bancaria padrão, faixa de valor, prioridade, contador `hits` e `last_applied_at`.
- Tabela `bank_balance_snapshots` (UNIQUE bank_account+date): saldo, saldo_conciliado, saldo_previsto, source.
- RPC `match_statement_to_cashflow_v2`: score ponderado **50% valor + 30% data + 20% similaridade textual** (pg_trgm). Hook usa v2 com fallback para v1.
- RPC `auto_reconcile_statement_batch(p_org, min_score=0.95, limit=200)`: itera linhas pendentes e aplica reconcile do melhor candidato acima do threshold. UI tem botão "Auto-conciliar".
- RPC `snapshot_bank_balances_daily(p_org, date)`: gera snapshot de todas as contas ativas. UI tem botão "Snapshot de Saldos".
- RPC `apply_reconciliation_rules(p_org, only_unclassified=true)`: preenche account_id/cost_center_id/entity_id/conta_bancaria_id em cashflow_entries conforme regras ativas (priority asc), incrementando `hits`.

## Fases pendentes
- **Fase 3** — Webhooks: `integration_endpoints`, edge function `webhook-ingest` (Zod + idempotência via `external_id`), aba "Integrações", `import_templates` por ERP, dedup pré-import.
- **Fase 4** — UX cockpit: gráfico saldo acumulado/runway, filtros globais persistidos em URL, refator `ContasBancariasTab`, AR ganha PendenciasPanel, padronizar `fmtAcc` em todas as tabelas, export CSV/PDF do Fluxo, UI CRUD de `reconciliation_rules`.

## Convenções
- Todo split de valores em N partes deve usar `splitInstallments` (não `Math.round(x/n)`).
- Toda mudança de valor/status/conta em `cashflow_entries` é auditada automaticamente — não criar logs paralelos.
- `[backfill-pendente]` em `notes` sinaliza linha para revisão manual de conta bancária.
