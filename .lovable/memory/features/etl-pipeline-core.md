---
name: ETL/ELT Pipeline Core
description: Núcleo unificado de pipelines de importação, integração e agendamento (etl_jobs/items/pipelines, edge functions worker+scheduler, página /etl-ops)
type: feature
---

## Núcleo (Fase 1 — implementado)

**Tabelas:**
- `etl_pipelines` — catálogo (key, module, label, worker, cron_expr, max_attempts, batch_size). Leitura pública autenticada; escrita só master/backoffice_admin.
- `etl_jobs` — 1 linha por execução. Status: `queued|running|succeeded|failed|partial|cancelled`. Source: `upload|webhook|api|cron|manual`. UNIQUE (org, pipeline_key, idempotency_key).
- `etl_job_items` — 1 linha por registro. Status: `queued|running|succeeded|failed|skipped|dead`. Backoff exponencial: 1, 5, 30, 120 min. UNIQUE (job_id, idempotency_key).
- View `etl_jobs_unified` (security_invoker) — UNION com `data_imports` legados para histórico.

**RPCs:**
- Authenticated: `etl_retry_item`, `etl_retry_failed`, `etl_cancel_job`.
- Service-role only (worker): `etl_claim_items` (SELECT FOR UPDATE SKIP LOCKED), `etl_mark_item_success/failure/skipped`, `etl_finalize_job`.

**Edge functions:**
- `etl-worker` — drena lote (50), dispatcha por `pipeline_key` via registry interno, marca sucesso/falha/skip, finaliza jobs. `verify_jwt=false` mas só service_role pode invocar RPCs sensíveis.
- `etl-scheduler` — drena worker até 5x e enfileira jobs cron (1×/dia por pipeline com `cron_expr`).

**Front-end:** `src/modules/_etl/` (4-layer: contracts/services/hooks). Página `/etl-ops` com 4 KPIs (queued, running, succeeded, dlq) + 3 abas (jobs recentes, dead-letter, pipelines).

**Idempotência:** `idempotency_key = sha1(pipeline_key || external_ref || raw_canonico)` por item; UNIQUE constraint impede duplicatas.

## Próximas fases (planejado, não implementado)

- Fase 2: migrar `useFinanceiroImport`, `useBankStatementImport`, `webhook-ingest` para o pipeline.
- Fase 3: 6 pipelines DP (`dp.employees`, `dp.benefits`, `dp.payroll_events`, `dp.vacation_periods`, `dp.terminations`, `dp.timesheet`) + cron `dp.routine_alerts`.
- Fase 4: 6 pipelines TI (`ti.equipment`, `ti.licenses`, `ti.incidents`, `ti.tickets`, `ti.depreciation_snapshot` mensal, `ti.sla_calc` diário).
- Fase 5 MVP: `juridico.processes_csv`, `juridico.expenses_csv`, `tarefas.bulk_csv`, `tarefas.recorrencia_daily`, `cadastros.bulk_csv`.
- Fase 6: pg_cron real apontando para `etl-scheduler`, alertas Slack/Telegram em jobs `failed`, métricas (latência, throughput).

## Como adicionar um pipeline novo

1. `INSERT INTO etl_pipelines (key, module, label, ...)`.
2. Adicionar handler em `supabase/functions/etl-worker/index.ts` no `HANDLERS` map (ou separar em arquivo dedicado).
3. UI dispara `createJob` do `src/modules/_etl` com items + idempotency_key.
4. Histórico/DLQ aparece automaticamente em `/etl-ops`.
