---
name: Financeiro Hub Roadmap
description: Plano em 4 fases para tornar o módulo Financeiro um hub centralizador (importações + webhooks) substituível a ERP. Fases 1-4 implementadas.
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

## Fase 3 — Implementada
- Tabelas `integration_endpoints` (RLS: leitura para membros, escrita só admin/owner), `integration_events` (UNIQUE endpoint+external_id para idempotência), `import_templates` (mapeamentos reutilizáveis).
- Extensão `pgcrypto` + RPC `rotate_endpoint_secret(p_endpoint_id)`: gera token aleatório (64 hex), armazena só o sha256, retorna token em texto puro UMA vez (UI exibe em modal de copiar).
- Edge function `webhook-ingest` (verify_jwt=false, CORS aberto): autentica via header `X-Webhook-Token` (compara sha256), valida payload com Zod (external_id, event_type, data.{descricao,valor,tipo,data_prevista,...}), garante idempotência consultando `integration_events`, materializa `cashflow_entries` com defaults do endpoint, atualiza `events_count` e `last_received_at`.
- URL pública: `${VITE_SUPABASE_URL}/functions/v1/webhook-ingest?endpoint=<uuid>`.
- Aba "Integrações" no Financeiro: CRUD de endpoints, rotação de secret, toggle ativo/pausado, log de eventos recentes (50 últimos com status processed/received/error).

## Fase 4 — Implementada
- `src/hooks/useUrlState.ts` — hook genérico para sincronizar state ↔ URL (`?tab=`, `?view=`, `?ciclo=`). Persiste preferências do usuário entre reloads/links.
- `Financeiro.tsx`: aba ativa persistida em `?tab=`. `FluxoCaixaTab`: subview e ciclo persistidos em `?view=` e `?ciclo=`.
- `FluxoCaixaTab` ganhou 5 KPIs: Saldo Abertura, Entradas, Saídas, **Saldo Final Projetado** (= abertura + saldo do período), **Runway** (meses até o caixa zerar dado o burn projetado).
- `src/lib/fluxoCaixaExport.ts`: `exportFluxoCaixaCSV` (BOM UTF-8, separador `;` Excel-PT) e `exportFluxoCaixaPDF` (resumo + tabela com **Saldo Acumulado** rodante por linha, padrão contábil `(xxx)` em vermelho).
- `ReconciliationRulesDialog`: CRUD completo de `reconciliation_rules` (nome, padrão, modo contains/exact/regex, tipo, faixa de valor, prioridade, ativo) + botão "Aplicar regras agora" que chama RPC `apply_reconciliation_rules`. Acessível em `ConciliacaoTab` via botão "Regras".

## Convenções (mantidas)
- Todo split de valores em N partes deve usar `splitInstallments` (não `Math.round(x/n)`).
- Toda mudança de valor/status/conta em `cashflow_entries` é auditada automaticamente — não criar logs paralelos.
- `[backfill-pendente]` em `notes` sinaliza linha para revisão manual de conta bancária.
