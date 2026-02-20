
# Módulo de Planejamento Financeiro

## Status: Fase 2 + Fase 3 (Passivos) — IMPLEMENTADO

## Fase 1 — MVP Core ✅

### Banco de Dados
- [x] `budget_versions` — versões de orçamento com status (draft/approved/archived)
- [x] `budget_lines` — linhas mensais por conta/centro de custo
- [x] `planning_scenarios` — cenários com variáveis parametrizáveis
- [x] `planning_config` — saldo mínimo, colchão de liquidez, alerta runway
- [x] RLS policies em todas as tabelas

### Hooks
- [x] `useBudget.ts` + `useBudgetLines` — CRUD de versões e linhas de orçamento
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

## Fase 2 — Planejamento Avançado ✅

### Banco de Dados
- [x] `scenario_overrides` — overrides por conta/centro de custo por cenário

### Hooks
- [x] `useScenarioOverrides.ts` — CRUD de overrides por cenário

### Funcionalidades
- [x] Overrides por conta/centro (ajuste fino no cenário) — dialog com tabela + formulário inline
- [x] Projeções automáticas baseadas em histórico + contratos ativos (via useCashFlow híbrido)
- [x] Modo híbrido (fluxo de caixa real + contratos recorrentes como base de projeção)
- [ ] Relatórios exportáveis (PDF/Excel) — pendente integração de lib de export

## Fase 3 — Governança (Parcial)

### Banco de Dados
- [x] `liabilities` — passivos com tipo, probabilidade, stress e vínculos

### Hooks
- [x] `useLiabilities.ts` — CRUD + totais computados (dívidas, contingências, provisões, stress)

### Interface
- [x] **Passivos** (nova aba) — KPIs, filtro por tipo, tabela CRUD completa com dialog de edição
  - Tipos: Dívida, Contingência, Provisão
  - Status: Ativo, Negociação, Judicial, Quitado
  - Probabilidade (contingências): Provável, Possível, Remota
  - Impacto de stress (% adicional sob cenário adverso)
  - Vínculos com entidade, contrato e centro de custo

### Pendente (Fase 3)
- [ ] Gestão de Patrimônio + depreciação gerencial
- [ ] Gestão de Ativos Financeiros + rendimentos
- [ ] Investor Pack (templates + geração versionada)

## Fase 4 — Planejamento Comercial ✅

### Banco de Dados
- [x] `commercial_plans` — planos com modo top-down/bottom-up, período e orçamento
- [x] `commercial_budget_lines` — linhas orçamentárias (fixos, variáveis, mídia)
- [x] `commercial_channels` — canais de venda com funil de conversão
- [x] `commercial_scenarios` — cenários comerciais (conservador/realista/agressivo)
- [x] RLS policies em todas as tabelas

### Hooks
- [x] `useCommercialPlanning.ts` — CRUD de planos, linhas, canais e cenários + projeções

### Interface (7ª aba "Comercial")
- [x] Seletor de modo (Top-down / Bottom-up)
- [x] KPIs executivos: Orçamento, Comprometido, Runway Comercial, Receita, ROI, Payback
- [x] Linhas orçamentárias: Equipe (com encargos), Software, Comissões, Mídia
- [x] Funil de vendas por canal: Leads, conversões, ticket médio, ciclo, tipo contrato
- [x] Canais pré-definidos (Google Ads, Meta, LinkedIn, Indicação, Orgânico) + custom
- [x] Tabela executiva de projeção por canal com ROI/Payback individuais
- [x] Simulador de cenários com gráfico comparativo
- [x] Alertas automáticos: orçamento excedido, funil vazio, ROI negativo, payback > período
- [x] Trava orçamentária com pop-up de aprovação

---

# Módulo Backoffice Administrativo

## Status: Implementado ✅

### Banco de Dados
- [x] `user_roles` — roles globais (master/admin/user) com enum `app_role`
- [x] `user_permissions` — permissões por módulo/aba/organização
- [x] `organizations.status` — campo de status (ativa/suspensa/onboarding)
- [x] `organizations.plano` — campo de plano (básico/profissional/enterprise)
- [x] `profiles.cargo` — campo de cargo do usuário
- [x] `profiles.active` — campo de status ativo/inativo
- [x] RLS: Masters podem ver todas as orgs, profiles, membros e roles

### Hooks
- [x] `useBackoffice.ts` — queries e mutations para todo o backoffice

### Interface
- [x] Layout separado com tema claro corporativo (`BackofficeLayout.tsx`)
- [x] Guard de acesso: apenas usuários com role `master` acessam `/backoffice/*`
- [x] **Listagem de Empresas** — cards/lista com filtros (nome, CNPJ, status, plano)
- [x] **Tela Interna** com 7 abas:
  1. Resumo — KPIs, informações da empresa
  2. Usuários — tabela com nome, cargo, role, status, ações
  3. Permissões & Granularidade — Camada A (módulos), Camada B (escopos), Ações Sensíveis
  4. Módulos — visão geral dos módulos ativos com contagem de usuários
  5. Auditoria — logs filtráveis por ação e busca
  6. Integrações — placeholder
  7. Plano & Cobrança — seletor de plano + placeholder cobrança
- [x] Clonagem de permissões entre usuários
- [x] Módulos placeholder: Departamento Pessoal, Documentos da Empresa
- [x] Usuário master: m.santos@colliservice.com.br
