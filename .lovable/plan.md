# Maturidade Setorial — Piloto Financeiro

Replicar a mecânica já consolidada no DP (`evaluateDP` + `useSectorOnboarding` + `SectorOnboardingBar`) para o módulo Financeiro, reutilizando 100% da infraestrutura de cache (`sector_onboarding`), histórico (`sector_onboarding_history`), trilha de melhoria, drawer com tabs, exportação PDF e cron de snapshot/alertas.

## Escopo

1. **Avaliador** `src/lib/sectorMaturity/financeiro.ts` com `evaluateFinanceiro(input)` puro (mesma assinatura/retorno que `evaluateDP`).
2. **Hook** — estender `useSectorOnboarding.ts` para carregar os datasets do Financeiro quando `sector === "financeiro"` e despachar para `evaluateFinanceiro`.
3. **UI no módulo** — adicionar `<SectorOnboardingBar sector="financeiro" />` no topo de `src/pages/Financeiro.tsx`, com `onTabChange` mapeando para as abas existentes (`pagar`, `receber`, `aging`, `contas-bancarias`, `fluxo-caixa`, `conciliacao`, `importacoes`).
4. **Backoffice** — `SectorMaturityTab` já é genérico; basta adicionar a opção "Financeiro" no seletor (já listado em `SECTOR_META.financeiro`).
5. **Cron** — `sector-maturity-alerts` e `sector-maturity-snapshot` já são genéricos por setor; ampliar para também processar `sector='financeiro'` (alertas de período não fechado, contas vencidas sem baixa, contas bancárias sem saldo atualizado >7 dias).

## Regras do score (0–100)

Mesma estrutura 50/25/25 do DP.

### A. Completude (50 pts) — estrutura financeira existe?
| Pts | Item | Fonte |
|---|---|---|
| 8 | Plano de contas com nível 4 ativo (mín. 1 conta sintética + 1 analítica em receita e despesa) | `chart_of_accounts` |
| 6 | Centros de custo cadastrados (≥1 ativo) | `cost_centers` |
| 6 | Contas bancárias cadastradas (≥1 ativa) | `bank_accounts` |
| 6 | Saldos iniciais informados (`saldo_atualizado_em` not null em todas as contas ativas) | `bank_accounts` |
| 6 | Cadastro de entidades (fornecedores+clientes ≥3) | `entities` |
| 6 | Aglutinação configurada (≥1 macrogrupo + ≥1 grupo + ≥1 regra ativa) | `grouping_macrogroups`, `grouping_groups`, `grouping_rules` |
| 6 | Contratos recorrentes ativos com projeção (≥1) — confirma integração contratos→fluxo | `contracts` + projeções |
| 6 | Formas de pagamento padronizadas usadas (% de `cashflow_entries` com `forma_pagamento` not null) | `cashflow_entries` |

### B. Atualização (25 pts) — dado é confiável?
| Pts | Item |
|---|---|
| 8 | Período fiscal do mês anterior fechado (`fiscal_periods.status='closed'`) |
| 6 | Saldos bancários atualizados nos últimos 7 dias (% de contas com `saldo_atualizado_em >= now()-7d`) |
| 6 | Lançamentos do mês corrente classificados (% de `cashflow_entries` do mês com `account_id` e `cost_center_id` preenchidos) |
| 5 | Sem atrasos não resolvidos > 30 dias (penaliza % de entries `status='previsto'` com `data_vencimento < hoje-30d`) |

### C. Rotinas (25 pts) — operação acontece?
| Pts | Item |
|---|---|
| 10 | Conciliação do mês anterior executada (proxy: % de `cashflow_entries` do mês anterior com `status='realizado'` e `data_realizada` not null ≥ 90%) |
| 15 | Cumprimento das requests financeiras do mês (`requests` com `type IN ('expense_request','financeiro')` no mês — concluídas/total, com penalidade por atrasadas, espelhando a lógica do DP) |

Faixas iguais ao DP: `critico` (0–39), `desenvolvimento` (40–69), `maduro` (70–89), `excelente` (90+).

## Mapa CTA → aba do módulo Financeiro

- Plano de contas / aglutinação / centros de custo → módulo Configurações (link externo via `ctaTab` que a Bar já trata como deep-link)
- Contas bancárias / saldos → aba `contas-bancarias`
- Lançamentos atrasados / classificação → aba `aging` ou `pagar`
- Período fiscal não fechado → `fluxo-caixa`
- Conciliação → `conciliacao`
- Requests financeiras → módulo Solicitações

## Detalhes técnicos

- **Sem migration**: tudo encaixa em `sector_onboarding` / `sector_onboarding_history` (já criadas no piloto DP).
- **Reuso total** dos componentes: `SectorOnboardingBar`, `SectorOnboardingChecklist`, `ImprovementTrack`, `MaturityTrendChart`, `exportMaturityPdf` (são agnósticos ao setor).
- **Hook**: cargas isoladas com `enabled: sector === "financeiro"` para não pagar custo no DP. Persistência idempotente via `(organization_id, sector)`.
- **Edge Functions** (`sector-maturity-alerts`, `sector-maturity-snapshot`): adicionar branch para `sector='financeiro'` — alertas: período em aberto após dia 5, conta bancária sem atualização >7 dias, lançamentos vencidos >30d. Idempotência mantida via `(user_id, reference_type, reference_id)`.
- **Memória** `mem://features/sector-onboarding-maturity.md`: atualizar para refletir 2 setores ativos (DP + Financeiro) e o novo passo "Para escalar: já incluir Financeiro como referência".

## Arquivos previstos

Novos:
- `src/lib/sectorMaturity/financeiro.ts`

Editados:
- `src/hooks/useSectorOnboarding.ts` — carga + despacho do Financeiro
- `src/pages/Financeiro.tsx` — montar `SectorOnboardingBar` + `onTabChange`
- `src/components/sector-onboarding/SectorMaturityTab.tsx` — habilitar Financeiro no seletor (se ainda restrito)
- `supabase/functions/sector-maturity-alerts/index.ts` — branch `financeiro`
- `supabase/functions/sector-maturity-snapshot/index.ts` — incluir setor financeiro no loop
- `mem://features/sector-onboarding-maturity.md`

## Fora do escopo desta etapa
- Setores CRM, Contratos, Planejamento (próximas iterações usando o mesmo padrão).
- Reescrita visual/UX do módulo Financeiro (apenas inserir a barra no topo).
