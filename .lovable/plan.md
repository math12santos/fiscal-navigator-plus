
# Módulo de Planejamento Financeiro

## Status: Fase 1 (MVP Core) — EM ANDAMENTO

## Fase 1 — Implementado

### Banco de Dados
- [x] `budget_versions` — versões de orçamento com status (draft/approved/archived)
- [x] `budget_lines` — linhas mensais por conta/centro de custo
- [x] `planning_scenarios` — cenários com variáveis parametrizáveis
- [x] `planning_config` — saldo mínimo, colchão de liquidez, alerta runway
- [x] RLS policies em todas as tabelas

### Hooks
- [x] `useBudget.ts` — CRUD de versões e linhas de orçamento
- [x] `usePlanningScenarios.ts` — CRUD de cenários + seed padrão
- [x] `usePlanningConfig.ts` — upsert de configurações de liquidez

### Interface (5 abas)
- [x] **Visão Geral** — KPIs (receita/despesa/saldo projetados + runway), alerta saldo mínimo, gráfico mensal
- [x] **Orçamento** — versionamento, linhas por conta/centro/mês, tipos fixo/variável/híbrido
- [x] **Cenários** — Base/Otimista/Conservador/Stress + custom, gráfico comparativo
- [x] **Planejado × Realizado** — comparação orçado vs realizado com tabela de variação
- [x] **Liquidez** — configuração de saldo mínimo, colchão e alerta de runway

### Filtro de Horizonte Temporal
- [x] 3m, 6m, 12m, 24m, Personalizado com seletor de datas

## Fase 2 — Planejamento Avançado (Pendente)
- [ ] Overrides por conta/centro (ajuste fino no cenário)
- [ ] Projeções automáticas baseadas em histórico + contratos
- [ ] Modo híbrido (automático com overrides)
- [ ] Relatórios exportáveis (PDF/Excel)

## Fase 3 — Governança (Pendente)
- [ ] Gestão de Patrimônio + depreciação gerencial
- [ ] Gestão de Ativos Financeiros + rendimentos
- [ ] Gestão de Passivos + probabilidade + stress
- [ ] Investor Pack (templates + geração versionada)
