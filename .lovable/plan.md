## Diagnóstico

Hoje o FinCore tem **dois embriões de pipeline**, sem orquestração unificada:

**1. Spreadsheet path** (`data_imports` + `data_import_rows` + `import_templates`)
- Usado por: Financeiro (`ImportDialog`, `BankStatementImportDialog`), DP (`EmployeeImportDialog`), Cadastros (`CadastroImportDialog`).
- Status no banco: só `completed` / `reverted` — **não existem** `pending`, `processing`, `failed`, `partial`. A coluna existe, mas o fluxo grava direto como `completed`.
- Sem retry, sem reprocessamento granular por linha, sem job assíncrono — tudo roda síncrono no browser.
- `mapped_data` por linha existe, mas erros viram texto solto em `error_message`.

**2. Webhook path** (`integration_endpoints` + `integration_events` + edge function `webhook-ingest`)
- Tem idempotência boa (`UNIQUE(endpoint_id, external_id)`), índices corretos, status enum `received/processing/processed/failed`.
- Cobre apenas Financeiro hoje. Sem agendamento, sem retry automático, sem DLQ explícita.

**Gaps cobertos por este plano:**
- Não existe **fila/worker**: imports grandes travam o navegador.
- Não existe **agendamento diário** (pg_cron está disponível mas não usado para ETL).
- **Idempotência ad-hoc** por módulo (cada hook reinventa).
- **Reprocessamento** existe só como "reverter e refazer tudo" — não por linha/lote.
- **DP, TI, Jurídico, Tarefas** não têm pipeline padronizado.
- Sem **dashboard operacional** ("últimos jobs", "linhas com erro", "DLQ").

## Arquitetura proposta — pipeline ETL/ELT unificado

Duas trilhas paralelas, mesmo modelo de dados, mesma observabilidade:

```text
┌──────────────────────────────────────────────────────────────────┐
│                       FONTES                                      │
│  Upload CSV/XLSX  •  Webhook  •  API REST  •  Cron diário        │
└────────────────────┬─────────────────────────────────────────────┘
                     ▼
            ┌────────────────────┐
            │  STAGING (raw)     │  etl_jobs + etl_job_items
            │  status: pending   │  (idempotency_key UNIQUE)
            └────────┬───────────┘
                     ▼
            ┌────────────────────┐
            │  TRANSFORM         │  edge function `etl-worker`
            │  status: processing│  + RPCs por módulo
            └────────┬───────────┘
                     ▼
       ┌──────────────┴──────────────┐
       ▼                             ▼
  ┌──────────┐                  ┌──────────────┐
  │  DOMÍNIO │                  │  DLQ + retry │
  │ (tabelas │                  │  job_items   │
  │  reais)  │                  │  failed      │
  └──────────┘                  └──────────────┘
```

### Modelo de dados (novo)

| Tabela | Papel |
|---|---|
| `etl_jobs` | 1 linha por execução. Campos: `id`, `organization_id`, `module`, `pipeline_key`, `source` (`upload`/`webhook`/`api`/`cron`), `idempotency_key UNIQUE`, `status` (`queued`/`running`/`succeeded`/`failed`/`partial`), `total/ok/failed/skipped`, `started_at`, `finished_at`, `params jsonb`, `created_by`. |
| `etl_job_items` | 1 linha por registro (substitui o atual `data_import_rows`, generalizado). Campos: `job_id`, `seq`, `external_ref`, `idempotency_key UNIQUE(job_id, external_ref)`, `status`, `attempts`, `last_error`, `raw jsonb`, `mapped jsonb`, `target_table`, `target_id`. |
| `etl_pipelines` | Catálogo. Campos: `key` (ex: `financeiro.bank_statement`), `module`, `label`, `cron_expr` opcional, `worker` (`'rpc'`/`'edge'`), `target_handler`. |
| `etl_dead_letter` | View materializada filtrada de `etl_job_items WHERE status='failed' AND attempts >= max_attempts` para a UI de DLQ. |

> **Compatibilidade:** `data_imports` e `data_import_rows` continuam funcionando; criamos uma view `etl_jobs` que UNIONa imports legados, e os novos hooks já gravam direto no novo modelo. Migração suave.

### Idempotência

- **Regra única**: cada `etl_job_item` tem `idempotency_key = sha1(pipeline_key || external_ref || raw_canonico)`.
- O processamento materializa em domínio com `source` + `source_ref` MECE (já existe via `_contracts/projections.ts`).
- Reexecutar o mesmo job é **sempre seguro**: chaves duplicadas viram `skipped`.

### Fila e workers

- **Sem broker externo no MVP**: usamos uma tabela-fila + `etl-worker` edge function.
- Trigger pós-INSERT em `etl_jobs(status='queued')` chama `pg_net.http_post` para a edge function (padrão já usado pelo Finance Hub).
- `etl-worker`:
  1. `SELECT FOR UPDATE SKIP LOCKED` em até N items.
  2. Processa por `pipeline_key` → handler (RPC SQL ou função TS).
  3. Atualiza item (`succeeded`/`failed`+`last_error`+`attempts++`).
  4. Reagenda items `failed` com `attempts < max_attempts` via backoff exponencial (1m, 5m, 30m, 2h).
  5. Fecha o job: `succeeded` se todos OK, `partial` se parcial, `failed` se nenhum.

### Reprocessamento seguro

- Botão "Reprocessar item" → reseta `status='queued'` + `attempts=0` no job_item.
- Botão "Reprocessar job" → idem para todos os items `failed`.
- Botão "Reverter job" → soft-delete dos targets (já existe em `data_imports.reverted`); preserva idempotency_key.

### Agendamento diário (pg_cron)

`pg_cron` invoca `etl-scheduler` edge function 1×/dia (configurável por pipeline em `etl_pipelines.cron_expr`). A scheduler enfileira `etl_jobs(source='cron')` para cada org+pipeline ativo.

## Cobertura por módulo

### Pipeline completo (todas as abas)

**Financeiro** — pipelines:
- `financeiro.bank_statement` (OFX/CSV/XLSX) — substitui `useBankStatementImport`.
- `financeiro.cashflow_entries` — substitui `useFinanceiroImport`.
- `financeiro.contracts_installments`, `financeiro.suppliers`, `financeiro.expense_requests` — todos via mesma fila.
- `financeiro.webhook_inbound` — wrapper sobre `webhook-ingest` existente, virando job_items para reuso da DLQ.

**DP/RH** — pipelines:
- `dp.employees` (substitui `EmployeeImportDialog`), `dp.benefits`, `dp.payroll_events`, `dp.vacation_periods`, `dp.terminations`, `dp.timesheet`.
- Diário (cron): `dp.routine_alerts` (já existe edge function `sector-maturity-snapshot` — passa a ser job).

**TI** — pipelines:
- `ti.equipment`, `ti.licenses`, `ti.incidents`, `ti.tickets`, `ti.depreciation_snapshot` (cron mensal), `ti.sla_calc` (cron diário).
- Edge `it-daily-alerts` existente vira job no scheduler.

### Pipeline MVP (1 handler genérico, sem cron)

**Jurídico** — `juridico.processes_csv`, `juridico.expenses_csv`. Upload-only, sem webhook, sem cron. Reprocessamento via DLQ.

**Task Manager** — `tarefas.bulk_csv` (criar tarefas em lote a partir de planilha) + `tarefas.recorrencia_daily` (cron simples para gerar tarefas recorrentes).

**Cadastros** — `cadastros.bulk_csv` (já existe `CadastroImportDialog`, vira pipeline). Sem cron, sem webhook.

## Camadas no código (segue arquitetura modular existente)

```text
src/modules/_etl/                    ← núcleo do pipeline
├── _contracts/
│   ├── pipeline.ts                  ← PipelineHandler, JobItem, JobResult
│   └── etl.ts                       ← EtlJob, EtlJobItem, EtlStatus
├── services/
│   ├── jobsService.ts               ← createJob/listJobs/getJob/cancelJob
│   ├── itemsService.ts              ← retryItem/retryAllFailed
│   └── pipelinesService.ts          ← catálogo
├── hooks/
│   ├── useEtlJobs.ts
│   ├── useEtlJobItems.ts
│   └── useDeadLetter.ts
└── runtime/
    └── handlerRegistry.ts            ← map pipeline_key → handler

src/modules/<modulo>/etl/             ← handlers por módulo
├── financeiro/handlers/bankStatement.ts
├── dp/handlers/employees.ts
└── ...

supabase/functions/etl-worker/index.ts
supabase/functions/etl-scheduler/index.ts
```

UI:
- `src/pages/EtlOps.tsx` — dashboard global (jobs, DLQ, métricas).
- Por módulo: cada aba ganha botão "Importar" e "Histórico de jobs" reutilizando `<EtlJobsPanel module="dp" />`.

## Fases de implementação

**Fase 1 — Núcleo (sem mexer em módulo nenhum)**
- Migration: `etl_jobs`, `etl_job_items`, `etl_pipelines`, RLS, índices, triggers de timestamp.
- Edge function `etl-worker` (esqueleto + handler de teste).
- Edge function `etl-scheduler` + cron pg_cron 1×/dia.
- Módulo `src/modules/_etl/` (services/hooks/contratos).
- Página `/etl-ops` para CFO/admin (lista jobs, DLQ, métricas).

**Fase 2 — Migrar Financeiro (todas as abas)**
- Mover `useFinanceiroImport`, `useBankStatementImport`, webhook-ingest para o novo pipeline.
- Backfill de `data_imports` legados como jobs (read-only, para histórico unificado).

**Fase 3 — DP/RH**
- 6 pipelines listados acima + cron de alertas diários como jobs.

**Fase 4 — TI**
- 6 pipelines + cron mensal de depreciação + cron diário SLA/alertas.

**Fase 5 — MVP Jurídico, Tarefas, Cadastros**
- 1 handler "CSV genérico" + mapeamento por pipeline. Sem cron (exceto tarefas recorrentes).
- DLQ e reprocessamento herdados da Fase 1 — zero código novo de UI.

**Fase 6 — Endurecimento**
- Backoff exponencial real, max_attempts configurável, alertas Slack/Telegram em jobs `failed`, métricas (latência média, throughput) na página de ops.
- Promover ESLint warnings da arquitetura modular (Fase 5 da migração arquitetural) — ETL agora é exemplo modelar.

## Detalhes técnicos relevantes

- **Sem broker externo**: pg_cron + pg_net + edge function = fila durável. Suficiente para volumes do FinCore.
- **Lock**: `SELECT ... FOR UPDATE SKIP LOCKED` evita worker duplicado processar o mesmo item.
- **Backoff**: `next_attempt_at = now() + interval '1 min' * power(2, attempts)`.
- **Idempotência MECE**: reusa `projectionKey.*` de `_contracts/projections.ts` para chaves de domínio financeiro.
- **Auditoria**: cada transição de status grava em `audit_log` via contrato `_contracts/audit.ts`.
- **CORS**: `etl-worker` é interno (chamado por pg_net), `verify_jwt=false` + assinatura HMAC compartilhada com o banco (via secret).
- **Permissões**: página `/etl-ops` exige role `admin`/`owner`/`master`; reprocessamento exige a mesma role.
- **Retrocompatibilidade**: `data_imports` mantém RLS atual; nova view `etl_jobs_unified` UNIONa as duas tabelas para o painel.

## Entregáveis se aprovado

Executo **apenas a Fase 1** primeiro (núcleo + página de ops + 1 handler de teste). Depois pausamos para você validar o painel `/etl-ops` antes de migrar Financeiro (Fase 2). Isso evita big-bang e permite ajustar o modelo antes de ele ter dependências.

Diga **"executar fase 1 do ETL"** para começar, ou peça ajustes (ex.: prioridade diferente entre módulos, broker externo como Inngest no lugar de pg_cron, etc.).
