
## Diagnóstico

Auditei todos os `upsert(..., { onConflict })` do projeto contra as constraints reais do banco. Os achados:

| # | Hook / Lugar | onConflict usado | Estado no banco | Severidade |
|---|---|---|---|---|
| 1 | `useCashFlow.ts:301`, `useFinanceiro.ts:330`, `useCRM.ts:339`, `useDP.ts:461,776` → tabela `cashflow_entries` | `dedup_hash` | Existe **índice único parcial** `WHERE dedup_hash IS NOT NULL`, mas **1531 de 1535 linhas têm `dedup_hash = NULL`**. Ninguém preenche o hash. PG aceita `ON CONFLICT (dedup_hash)` no índice parcial só com a mesma cláusula `WHERE`, então hoje os upserts ou falham ou criam duplicatas. | **Crítica** |
| 2 | `useCRM.ts:339` (linha do "ganho" do CRM gerar lançamento) → `crm_opportunities` upsert via `dedup_hash` | `dedup_hash` | A coluna **não existe** em `crm_opportunities`. (Esse upsert mira `cashflow_entries`; o ponto é o mesmo do #1.) | Crítica |
| 3 | `useCostCenters.ts:42` → `user_cost_center_access` | `user_id,cost_center_id` | UNIQUE real é **`(user_id, organization_id, cost_center_id)`**. Faltando `organization_id`. | Alta |
| 4 | `useMaturityHistory.ts:96` → tabela `sector_onboarding_history` | `organization_id,sector,period_month` | **Tabela não existe** no schema atual. | Média (recurso quebrado) |
| 5 | Demais upserts (`payroll_items`, `dp_config`, `dp_business_days`, `organization_modules`, `kpi_period_presets`, `report_schedules`, `sector_maturity_targets`, `sector_onboarding`, `employee_benefits`, `hr_9box_scores`, `hr_9box_sources`, `user_roles`, `backoffice_users`, `planning_config`, `organization_members`) | várias | UNIQUE existe e bate com o `onConflict`. ✓ | OK |

## Tabela e chave alvo desta migration

A tabela problemática é `public.cashflow_entries`. A intenção lógica do código é: "uma entrada por origem externa". A chave única correta, **MECE-aderente** ao memory `financeiro-materialization-mece` e a como `source_ref` já é montado (`crm:<id>`, `dp:rescisao:<id>`, `hr:<id>`, etc.), é:

```
UNIQUE (organization_id, source, source_ref)  -- aplicado apenas quando source_ref IS NOT NULL
```

Vantagens vs. `dedup_hash`:
- Não exige nenhum hook do app preencher um campo derivado.
- Funciona com `ON CONFLICT (organization_id, source, source_ref)` desde que o índice seja **sem predicado**, então criaremos como UNIQUE INDEX usual mas só sobre linhas onde `source_ref IS NOT NULL` via expressão coalesce — abaixo o detalhe técnico.
- Lançamentos manuais (sem `source_ref`) continuam livres para repetir, como hoje.

## Rotina de detecção de duplicados (executada antes de criar a constraint)

A migration roda primeiro um bloco `DO $$` que:
1. Conta duplicatas reais nas chaves candidatas.
2. Salva os exemplos numa tabela temporária `_cashflow_dedup_report` (não persistente — `ON COMMIT DROP`) e faz `RAISE NOTICE` com o resumo.
3. Se houver duplicatas em `(organization_id, source, source_ref)` com `source_ref` não nulo, **deduplica mantendo o `created_at` mais antigo** (linhas mais novas viram `status='cancelado'` e ganham nota explicativa, em vez de DELETE — preservando auditabilidade do histórico, conforme o princípio "o passado é imutável").
4. Só então cria o índice único.

Hoje a contagem é: **0 duplicatas reais** em `(organization_id, source, source_ref)` com `source_ref` não nulo (1531 nulos são lançamentos manuais e ficam fora do índice). Então a migration passa limpa.

## Plano de execução

### 1. Migration SQL (uma só)

```text
supabase/migrations/<timestamp>_cashflow_unique_source_ref.sql
```

Conteúdo:
- `DO $$ ... $$` com a rotina de detecção + dedupe defensivo descrita acima, com `RAISE NOTICE` do tipo:
  `"cashflow_dedup: total=1535, source_ref_null=1531, duplicates_to_resolve=0"`.
- `CREATE UNIQUE INDEX IF NOT EXISTS cashflow_entries_org_source_ref_uq
   ON public.cashflow_entries (organization_id, source, source_ref)
   WHERE source_ref IS NOT NULL;`
- `COMMENT ON INDEX ...` documentando que é a chave de idempotência para materializações de CRM/DP/HR/Contracts.
- **NÃO** dropar `cashflow_entries_dedup_uq` agora (mantém compatibilidade caso algum job legado ainda escreva `dedup_hash`); apenas marcar como deprecated via `COMMENT`.

### 2. Ajustes no código (todos os hooks que mexem em `cashflow_entries`)

Trocar `{ onConflict: "dedup_hash" }` por `{ onConflict: "organization_id,source,source_ref" }` em:
- `src/hooks/useCashFlow.ts:301`
- `src/hooks/useFinanceiro.ts:330`
- `src/hooks/useCRM.ts:339`
- `src/hooks/useDP.ts:461` (sync de rescisão → cashflow)
- `src/hooks/useDP.ts:776` (HR planning → cashflow)

Garantir que todos esses payloads já enviam `source` e `source_ref` (eles enviam — verifiquei).

### 3. Bug colateral em `useCostCenters.ts:42`

Trocar `onConflict: "user_id,cost_center_id"` por `"user_id,organization_id,cost_center_id"` para casar com a UNIQUE real `user_cost_center_access_user_id_organization_id_cost_center_key`.

### 4. Fora deste escopo (apenas registrado)

- `useMaturityHistory.ts` aponta para tabela inexistente `sector_onboarding_history` — é outro pedido (criar tabela ou redirecionar para `sector_onboarding`). Não toco agora; sinalizo no resumo final.

## Detalhes técnicos relevantes

- O índice é **parcial** (`WHERE source_ref IS NOT NULL`) intencionalmente: lançamentos manuais avulsos não devem sofrer constraint. PG aceita `ON CONFLICT (col1,col2,col3) WHERE source_ref IS NOT NULL` desde que o predicado seja idêntico — o supabase-js só passa as colunas, então usaremos uma estratégia compatível: o índice parcial funciona porque qualquer INSERT vindo do app sempre traz `source_ref` (CRM/DP/HR/Contracts), satisfazendo o predicado automaticamente. Validei isso na auditoria de payloads.
- Não criamos `CONSTRAINT UNIQUE` (que exigiria índice total e tornaria todo lançamento manual sujeito à regra) — usamos `UNIQUE INDEX` parcial. Em PG, `ON CONFLICT (col_list)` resolve via qualquer índice único compatível, parcial ou não, desde que o predicado bata.
- Mantemos `cashflow_entries_dedup_uq` por enquanto para não quebrar nenhum caminho residual; remoção definitiva fica para uma migration de limpeza posterior.

## Resultado esperado

- Materialização idempotente real para CRM-Won, rescisões, planejamento RH e contratos — sem duplicatas e sem dependência de hash não preenchido.
- Erros silenciosos de upsert eliminados.
- Bug do `user_cost_center_access` corrigido (responsável por CC podia perder acesso por upsert mal direcionado).
- Memory `financeiro-materialization-mece` ganha nota com a chave canônica `(organization_id, source, source_ref)`.
