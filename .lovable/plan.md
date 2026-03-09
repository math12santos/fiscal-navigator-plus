

# Onboarding Guiado — Plano de Implementação

## Visão Geral

Criar um sistema de onboarding em duas faces:
1. **App-side**: Wizard multi-etapa com progresso, salvamento automático, navegação livre
2. **Backoffice-side**: Painel de gestão do onboarding de cada cliente

---

## Database Changes (Migration)

### Tabela `onboarding_progress`
Armazena o progresso do onboarding guiado por organização.

```sql
CREATE TABLE public.onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  current_step integer NOT NULL DEFAULT 1,
  completed_steps integer[] NOT NULL DEFAULT '{}',
  maturity_level integer DEFAULT NULL,        -- 1-5
  maturity_score text DEFAULT NULL,           -- Bronze/Prata/Ouro/Board Ready
  diagnosis_answers jsonb DEFAULT '{}',       -- Etapa 1 responses
  structure_data jsonb DEFAULT '{}',          -- Etapa 2 data
  integrations_data jsonb DEFAULT '{}',       -- Etapa 3
  financial_structure_data jsonb DEFAULT '{}',-- Etapa 4
  contracts_data jsonb DEFAULT '{}',          -- Etapa 5
  planning_data jsonb DEFAULT '{}',           -- Etapa 6
  routines_data jsonb DEFAULT '{}',           -- Etapa 7
  cockpit_activated boolean DEFAULT false,    -- Etapa 8
  assisted_start_date date DEFAULT NULL,      -- Etapa 9
  score_dimensions jsonb DEFAULT '{}',        -- Etapa 10
  status text NOT NULL DEFAULT 'em_andamento', -- em_andamento, concluido, pausado
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT NULL,
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
```

### Tabela `onboarding_recommendations`
Recomendações automáticas geradas nos primeiros 90 dias (Etapa 9).

```sql
CREATE TABLE public.onboarding_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  message text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  priority text NOT NULL DEFAULT 'media'
);

ALTER TABLE public.onboarding_recommendations ENABLE ROW LEVEL SECURITY;
```

RLS: Org members can view/update, masters can manage all.

---

## App-Side: Wizard de Onboarding (`/onboarding-guiado`)

### Componentes

1. **`src/pages/OnboardingGuiado.tsx`** — Página principal do wizard
   - Barra de progresso horizontal com 10 etapas nomeadas
   - Navegação prev/next + skip
   - Salvamento automático a cada mudança de etapa (debounced upsert em `onboarding_progress`)
   - Renderiza o step component ativo

2. **`src/components/onboarding-guiado/`** — Pasta com componentes por etapa:
   - `Step1Diagnostico.tsx` — Questionário com radio/select, cálculo automático de nível de maturidade (1-5) baseado nas respostas
   - `Step2Estrutura.tsx` — Forms para empresas do grupo, usuários principais, áreas; integra com tabelas existentes (`organizations`, `organization_members`, `organization_holdings`)
   - `Step3Integracoes.tsx` — Cards de integrações disponíveis (bancos, ERPs); upload OFX/CSV; status de conexão
   - `Step4EstruturaFinanceira.tsx` — Plano de contas sugerido (pré-populado) + centros de custo; usa hooks existentes `useChartOfAccounts` e `useCostCenters`
   - `Step5Contratos.tsx` — Formulário simplificado de contratos por tipo (receita/despesa/investimento); usa `useContracts`
   - `Step6Planejamento.tsx` — Criação de orçamento + cenários; usa `useBudget` e `usePlanningScenarios`
   - `Step7Rotinas.tsx` — Checklist de rotinas sugeridas (diárias/semanais/mensais) com toggle de ativação
   - `Step8Cockpit.tsx` — Preview dos dashboards que serão liberados; botão de ativação
   - `Step9OperacaoAssistida.tsx` — Lista de recomendações ativas do sistema; dismiss individual
   - `Step10Score.tsx` — Visualização do score de maturidade com radar chart (5 dimensões) e classificação (Bronze/Prata/Ouro/Board Ready)

3. **`src/components/onboarding-guiado/OnboardingProgressBar.tsx`** — Barra de progresso reutilizável com steps clicáveis

4. **`src/hooks/useOnboardingProgress.ts`** — Hook para CRUD na tabela `onboarding_progress` com auto-save

### Lógica de Maturidade (Etapa 1)
Algoritmo baseado em pontuação das respostas do diagnóstico:
- Controle por planilha = 1pt, ERP = 2pt
- Sem DRE = 0pt, DRE gerencial = 2pt, integrada à contábil = 3pt
- Sem auditoria = 0pt, com auditoria = 2pt
- Score total → Nível 1-5

### Lógica de Score Final (Etapa 10)
5 dimensões avaliadas por completude dos dados no sistema:
- Controle financeiro: % de contas classificadas
- Planejamento: existência de orçamento + cenários
- Governança: contratos cadastrados + rotinas ativas
- Previsibilidade: projeções configuradas
- Qualidade dos dados: % de conciliação

Classificação: <40% Bronze, <60% Prata, <80% Ouro, ≥80% Board Ready

---

## Backoffice-Side: Gestão de Onboarding

### Componentes

1. **`src/pages/BackofficeOnboarding.tsx`** — Página de gestão
   - Tabela com todas as organizações e seu status de onboarding
   - Colunas: Empresa, Etapa Atual, % Concluído, Nível Maturidade, Score, Status, Data Início
   - Filtros por status (em andamento, concluído, pausado)
   - Click em empresa → detalhe expandido com progresso por etapa
   - Badge visual do score (Bronze/Prata/Ouro/Board Ready)

2. **Rota**: `/backoffice/onboarding` adicionada ao `BackofficeLayout.tsx` nav items

3. **Hook**: `useBackofficeOnboarding.ts` — Query de todas as orgs com join em `onboarding_progress`

---

## Routing Changes

- `App.tsx`: Adicionar rota `/onboarding-guiado` como rota protegida
- `BackofficeLayout.tsx`: Adicionar nav item "Onboarding" com ícone `Rocket`
- `App.tsx` backoffice routes: Adicionar `/backoffice/onboarding`

---

## Escopo de Implementação

Dado o tamanho do feature, a implementação será dividida em fases:

**Fase 1** (esta implementação):
- Migração DB (tabelas + RLS)
- Wizard shell com barra de progresso e navegação
- Etapas 1 (Diagnóstico) e 10 (Score) completas
- Etapas 2-9 como shells funcionais com dados salvos em JSONB
- Página de gestão no Backoffice
- Hook de auto-save
- Roteamento completo

**Fase 2** (futura):
- Integração profunda das etapas 2-8 com módulos existentes
- Sistema de recomendações automáticas (Etapa 9)
- Score no dashboard principal

