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

## Fases pendentes
- **Fase 2** — Conciliação & governança: `reconciliation_rules`, auto-match score≥95%, RPC v2 com Jaro-Winkler, snapshot diário de saldos (`bank_balance_snapshots` via cron).
- **Fase 3** — Webhooks: `integration_endpoints`, edge function `webhook-ingest` (Zod + idempotência via `external_id`), aba "Integrações", `import_templates` por ERP, dedup pré-import.
- **Fase 4** — UX cockpit: gráfico saldo acumulado/runway, filtros globais persistidos em URL, refator `ContasBancariasTab`, AR ganha PendenciasPanel, padronizar `fmtAcc` em todas as tabelas, export CSV/PDF do Fluxo.

## Convenções
- Todo split de valores em N partes deve usar `splitInstallments` (não `Math.round(x/n)`).
- Toda mudança de valor/status/conta em `cashflow_entries` é auditada automaticamente — não criar logs paralelos.
- `[backfill-pendente]` em `notes` sinaliza linha para revisão manual de conta bancária.
