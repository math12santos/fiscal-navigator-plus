# Plano: Módulo de Gestão de Tarefas por Solicitações

## Visão Geral

Substituir o módulo atual de tarefas (mock data estático) por um sistema completo de **solicitações → tarefas → notificações**, funcionando como motor de workflow interno conectado a todos os módulos.

---

## 1. Estrutura de Dados (Migrações)

### Tabela `requests` (Solicitações)

```text
id, organization_id, user_id (criador), title, type (financeiro/compras/contratos/juridico/rh/ti/operacional),
area_responsavel, assigned_to (uuid), description, priority (alta/media/baixa/urgente),
due_date, cost_center_id, reference_module, reference_id, status (aberta/em_analise/em_execucao/aguardando_aprovacao/concluida/rejeitada),
created_at, updated_at
```

### Tabela `request_tasks` (Tarefas geradas)

```text
id, request_id (FK), organization_id, assigned_to, status, due_date,
created_by, executed_by, approved_by, created_at, updated_at
```

### Tabela `request_comments` (Comentarios/Historico)

```text
id, request_id (FK), user_id, content, type (comment/status_change/assignment/approval),
old_value, new_value, created_at
```

### Tabela `request_attachments`

```text
id, request_id (FK), user_id, file_name, file_path, created_at
```

### Tabela `notifications`

```text
id, organization_id, user_id (destinatario), title, body, type, priority,
reference_type (request/task), reference_id, read, read_at, created_at
```

RLS: Todas com `is_org_member` para SELECT, INSERT com `auth.uid() = user_id`. Notifications visíveis apenas pelo destinatário.

Habilitar realtime em `notifications` para push instantâneo.

---

## 2. Componentes e Páginas

### Página `Tarefas.tsx` (reescrita completa)

Três abas controladas por permissões (`getAllowedTabs`):


| Aba            | Key              | Conteúdo                                                                                  |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| Dashboard      | `dashboard`      | KPIs (abertas, atrasadas, por área, por responsável, produtividade), gráficos recharts    |
| Solicitações   | `solicitacoes`   | Tabela de requests com filtros (tipo, prioridade, status, área), botão "Nova Solicitação" |
| Minhas Tarefas | `minhas-tarefas` | Tasks atribuídas ao usuário logado, com ações rápidas de status                           |


### Dialog `RequestFormDialog.tsx`

Formulário de criação/edição de solicitação com campos: título, tipo, área, responsável, descrição, prioridade, data limite, centro de custo, referência a módulo.

### Componente `RequestDetail.tsx`

Painel lateral (Sheet) com detalhes da solicitação, timeline de histórico, comentários, anexos, e ações (mudar status, reatribuir, aprovar/rejeitar).

### Central de Notificações `NotificationCenter.tsx`

Ícone de sino no `AppLayout` (header ou sidebar) com badge de contagem. Dropdown/popover com lista de notificações agrupadas por prioridade/prazo, com link direto para a tarefa. Realtime via canal Supabase.

---

## 3. Hooks

- `useRequests.ts` — CRUD de solicitações com filtros
- `useRequestTasks.ts` — Tarefas vinculadas a uma solicitação
- `useRequestComments.ts` — Comentários e histórico
- `useNotifications.ts` — Fetch, mark as read, realtime subscription, contagem de não-lidas

---

## 4. Integração com Outros Módulos

Função utilitária `createRequest()` que pode ser chamada de qualquer módulo para disparar solicitações automaticamente. Exemplos de uso futuro:

- Financeiro → "Aprovação de pagamento"
- Contratos → "Revisão jurídica"
- DP → "Solicitação de contratação"

Implementação inicial apenas no módulo de Tarefas (manual). Os disparos automáticos de outros módulos ficam preparados mas serão ativados incrementalmente a partir de uma integração com fluxo de trabalho e rotinas por cargo que será implementado futuramente.

---

## 5. Atualização de Definições

- `moduleDefinitions.ts`: Adicionar tabs `dashboard`, `solicitacoes`, `minhas-tarefas` ao módulo `tarefas`
- `BackofficeCompany.tsx`: Sincronizar tabs do módulo tarefas
- `AppLayout.tsx`: Adicionar ícone de notificações no header

---

## 6. Fluxo Operacional

```text
Usuário cria solicitação
  → Sistema gera task vinculada
  → Responsável recebe notificação (realtime)
  → Responsável executa (muda status)
  → Sistema registra histórico
  → Se necessário → status "Aguardando Aprovação"
  → Aprovador recebe notificação
  → Solicitação concluída/rejeitada
```

---

## Ordem de Implementação

1. Criar tabelas via migração (requests, request_comments, request_attachments, notifications) com RLS
2. Habilitar realtime em `notifications`
3. Criar hooks (`useRequests`, `useRequestComments`, `useNotifications`)
4. Reescrever `Tarefas.tsx` com abas Dashboard, Solicitações, Minhas Tarefas
5. Criar `RequestFormDialog` e `RequestDetail`
6. Criar `NotificationCenter` e integrar no `AppLayout`
7. Atualizar `moduleDefinitions.ts` e `BackofficeCompany.tsx`

---

# Onboarding Guiado — Implementação (Fase 1 ✅)

## Status: Implementado

### Tabelas criadas
- `onboarding_progress` — progresso por organização com JSONB por etapa
- `onboarding_recommendations` — recomendações automáticas

### RLS
- Org members: SELECT, INSERT (com user_id check), UPDATE
- Masters: ALL

### Componentes implementados
- `src/pages/OnboardingGuiado.tsx` — Wizard com 10 etapas, barra de progresso, navegação livre
- `src/components/onboarding-guiado/OnboardingProgressBar.tsx` — Barra de progresso clicável
- `src/components/onboarding-guiado/Step1Diagnostico.tsx` — Questionário com cálculo automático de maturidade (1-5)
- `src/components/onboarding-guiado/Step10Score.tsx` — Score de maturidade com 5 dimensões (Bronze/Prata/Ouro/Board Ready)
- `src/components/onboarding-guiado/StepShell.tsx` — Shell reutilizável para etapas 2-9 (Fase 2)
- `src/pages/BackofficeOnboarding.tsx` — Gestão de onboarding no backoffice
- `src/hooks/useOnboardingProgress.ts` — Hook com auto-save debounced

### Rotas
- `/onboarding-guiado` — Wizard no app
- `/backoffice/onboarding` — Gestão no backoffice

### Fase 2 (pendente)
- Integração profunda das etapas 2-8 com módulos existentes
- Sistema de recomendações automáticas (Etapa 9)
- Score no dashboard principal

---

# Configurador de Regras de Aglutinação — Fase 1 (MVP) ✅

## Status: Implementado

### Tabelas criadas
- `grouping_macrogroups` — Macrogrupos hierárquicos com nome, ícone, cor, ordem, enabled
- `grouping_groups` — Grupos dentro de macrogrupos com FK para macrogroup_id
- `grouping_rules` alterada — Adicionadas colunas `group_id`, `operator`, `match_keyword`

### RLS
- Org members: SELECT, INSERT, UPDATE, DELETE em ambas tabelas

### Hooks implementados
- `src/hooks/useGroupingMacrogroups.ts` — CRUD macrogrupos + grupos + seed de 10 macrogrupos padrão
- `src/hooks/useGroupingRules.ts` — Refatorado com operadores (equals, contains, starts_with, in_list), match por keyword/descrição, group_id targeting, fallback "Não Classificado"

### Componentes implementados
- `src/components/financeiro/GroupingMacrogroupManager.tsx` — UI colapsável de macrogrupos/grupos com CRUD inline, toggle ativo/inativo, botão "Gerar Padrão"
- `src/components/financeiro/GroupingRuleDialog.tsx` — Refatorado com operador, campo dinâmico (select por tipo), grupo destino, keyword input para descrição
- `src/pages/Configuracoes.tsx` — Aba Aglutinação com 3 blocos: Macrogrupos, Regras de Classificação, Fallback

### Seed padrão (10 macrogrupos)
- Pessoal e RH, Infraestrutura, Tecnologia e Sistemas, Fornecedores Operacionais, Serviços Profissionais, Tributário, Financeiro, Contratos, Patrimonial/Investimentos, Despesas Eventuais

### Integração
- AgingListTab e FinanceiroTable integrados com o novo sistema de regras (operadores avançados, group_id)
- Fallback automático para "Não Classificado" em entradas sem match
