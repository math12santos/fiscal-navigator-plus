# Metas de Maturidade Configuráveis por Organização

Hoje os cortes do termômetro estão hardcoded nos avaliadores (`evaluateDP` / `evaluateFinanceiro`) e o único valor configurável é `dp_config.meta_rotinas_pct`. Vou unificar tudo numa única tabela `sector_maturity_targets` por organização+setor, com fallback de defaults globais.

## Modelo de dados

Nova tabela **`sector_maturity_targets`** (uma linha por org+setor):

| Coluna | Tipo | Default | Significado |
|---|---|---|---|
| `id` | uuid | gen | PK |
| `organization_id` | uuid FK | — | escopo |
| `sector` | text | — | `dp` \| `financeiro` |
| `routines_target_pct` | numeric | 0.85 | % de rotinas/requests cumpridas (DP+Fin) |
| `routines_overdue_tolerance_pct` | numeric | 0.10 | tolerância de atraso antes de penalizar |
| `reconciliation_target_pct` | numeric | 0.90 | % de conciliação (Fin) |
| `classification_target_pct` | numeric | 0.95 | % de entries com `account_id`+`cost_center_id` (Fin) |
| `bank_freshness_days` | integer | 7 | dias máximos para considerar saldo "fresco" (Fin) |
| `overdue_critical_days` | integer | 30 | dias para classificar lançamento como "vencido crítico" (Fin) |
| `overdue_max_count` | integer | 10 | quantos vencidos críticos zeram a nota (Fin) |
| `documents_required` | text[] | `{contrato,rg,cpf}` | docs obrigatórios por colaborador (DP) |
| `payroll_close_required` | bool | true | exige folha do mês anterior fechada (DP) |
| `period_close_required` | bool | true | exige período fiscal anterior fechado (Fin) |
| `created_at`/`updated_at` | timestamptz | now() | auditoria |
| Unique | (organization_id, sector) | | |

**RLS:** SELECT por membros da org; INSERT/UPDATE por owners/admins/master/backoffice.

**Sem trigger de seed**: os defaults vêm da própria coluna; quando não há linha, o avaliador usa constantes default em código (`DEFAULT_TARGETS`).

`dp_config.meta_rotinas_pct` fica mantida por retrocompatibilidade — uma migration leve copia o valor para `sector_maturity_targets.routines_target_pct` quando existir, mas a fonte de verdade passa a ser a nova tabela.

## Avaliadores

Ambos `evaluateDP` e `evaluateFinanceiro` recebem um novo parâmetro `targets: SectorMaturityTargets` (já normalizado pelo hook, com fallback). Substituir os literais por `targets.*`:

- DP:
  - rotinas: usa `routines_target_pct` e `routines_overdue_tolerance_pct`
  - documentos obrigatórios: `documents_required`
  - folha mês anterior: só pontua se `payroll_close_required`
- Financeiro:
  - conciliação: `10 * min(1, rate / reconciliation_target_pct)`
  - classificação: `6 * min(1, rate / classification_target_pct)`
  - saldo fresco: cutoff = `now() - bank_freshness_days`
  - vencidos críticos: cutoff = `now() - overdue_critical_days`; penalidade linear até `overdue_max_count`
  - período fechado: só pontua se `period_close_required`
  - rotinas: idem DP

## Hook

`useSectorOnboarding` carrega 1 query adicional `targets` (por org+setor), normaliza com `DEFAULT_TARGETS` quando ausente e injeta no avaliador.

`useSectorMaturityTargets(sector)` exposto para a UI editar; mutação faz upsert em `(organization_id, sector)` e invalida o cache de maturidade.

## UI: editor de metas

Novo componente **`SectorMaturityTargetsDialog`** (drawer/modal compartilhado pelos dois setores).

Acesso via:
1. Botão **"Metas"** no `SectorOnboardingBar` (entre Trilha e Exportar), visível só para owner/admin/master.
2. Aba **"Metas de Maturidade"** dentro do `SectorMaturityTab` no Backoffice (lê e edita por organização).

Form contém apenas os campos relevantes do setor selecionado (DP esconde campos só do Financeiro e vice-versa). Cada campo mostra o valor default e botão "Restaurar padrão".

**Validações** (zod):
- pcts entre 0 e 1
- inteiros >= 1 para `bank_freshness_days`/`overdue_critical_days`/`overdue_max_count`
- `documents_required`: array não vazio, lowercase

## Cron (`sector-maturity-alerts`)

Substituir o fetch de `dp_config.meta_rotinas_pct` por `sector_maturity_targets` (com fallback 0.85). Estender o disparo de alertas para usar também os limites do Financeiro:
- período fiscal anterior aberto após dia 5 do mês corrente
- contas bancárias sem atualização > `bank_freshness_days`
- vencidos > `overdue_critical_days`

## Arquivos previstos

Novos:
- migration: `sector_maturity_targets` + RLS + backfill de `meta_rotinas_pct` para DP
- `src/lib/sectorMaturity/targets.ts` — `DEFAULT_TARGETS`, tipo `SectorMaturityTargets`, normalizador
- `src/hooks/useSectorMaturityTargets.ts` — read/write
- `src/components/sector-onboarding/SectorMaturityTargetsDialog.tsx`

Editados:
- `src/lib/sectorMaturity/dp.ts` — receber `targets`, substituir literais
- `src/lib/sectorMaturity/financeiro.ts` — receber `targets`, substituir literais
- `src/hooks/useSectorOnboarding.ts` — carregar e injetar targets
- `src/components/sector-onboarding/SectorOnboardingBar.tsx` — botão "Metas"
- `src/components/sector-onboarding/SectorMaturityTab.tsx` — aba Backoffice "Metas"
- `supabase/functions/sector-maturity-alerts/index.ts` — usar nova tabela
- `mem://features/sector-onboarding-maturity.md` — documentar metas configuráveis

## Fora do escopo
- Metas para CRM/Contratos/Planejamento (segue o mesmo padrão quando esses setores forem ativados).
- Versionamento histórico das metas (não há registro auditável de mudanças além do `updated_at`).
