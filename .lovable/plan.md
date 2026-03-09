

# Configuração Completa do Onboarding — Plano

## Objetivo

Criar uma aba **Configuração** no Backoffice Onboarding que permita ao admin editar a estrutura de **todas as 10 etapas** do onboarding, incluindo:
- Etapa 1: perguntas, opções e pontos do diagnóstico + thresholds de maturidade
- Etapas 2-9: título, descrição, ícone e lista de itens exibidos no StepShell
- Etapa 10: dimensões do score (label, steps associados) + thresholds de classificação (Bronze/Prata/Ouro/Board Ready)

## Database

### Tabela `onboarding_step_config`

Armazena a configuração de todas as etapas num único lugar flexível.

```sql
CREATE TABLE public.onboarding_step_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number integer NOT NULL,            -- 1-10
  config jsonb NOT NULL DEFAULT '{}',      -- conteúdo varia por etapa
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT NULL,
  UNIQUE(step_number)
);
ALTER TABLE public.onboarding_step_config ENABLE ROW LEVEL SECURITY;
-- Masters only
CREATE POLICY "Masters can manage step config" ON public.onboarding_step_config
  FOR ALL TO public USING (has_role(auth.uid(), 'master'));
-- All authenticated can read (wizard needs it)
CREATE POLICY "Authenticated can read step config" ON public.onboarding_step_config
  FOR SELECT TO authenticated USING (true);
```

**Config JSONB structure per step type:**

- **Step 1** (Diagnosis):
```json
{
  "sections": [
    { "key": "estrutura", "label": "Estrutura", "icon": "Building2", "order": 0,
      "questions": [
        { "key": "num_empresas", "label": "Quantas empresas...", 
          "options": [{"value":"1","label":"1","points":0}, {"value":"2-5","label":"2 a 5","points":1}] }
      ]
    }
  ],
  "thresholds": [
    { "level": 1, "label": "Controle básico", "min_score": 0, "max_score": 2 },
    ...
  ]
}
```

- **Steps 2-9** (Shell):
```json
{
  "title": "Estrutura da Empresa",
  "description": "Configure a estrutura organizacional",
  "icon": "Building2",
  "items": ["Empresas do grupo...", "Usuários principais...", "Áreas organizacionais..."]
}
```

- **Step 10** (Score):
```json
{
  "dimensions": [
    { "key": "controle", "label": "Controle Financeiro", "icon": "ShieldCheck", "color": "text-emerald-500", "steps": [1, 4] }
  ],
  "thresholds": [
    { "label": "Bronze", "min_pct": 0 },
    { "label": "Prata", "min_pct": 40 },
    { "label": "Ouro", "min_pct": 60 },
    { "label": "Board Ready", "min_pct": 80 }
  ]
}
```

Seed migration inserts all 10 rows with current hardcoded values as defaults.

## Frontend Changes

### 1. `BackofficeOnboarding.tsx`
Wrap in `Tabs` with two tabs:
- **Acompanhamento** — current tracking table (existing content)
- **Configuração** — new `OnboardingConfigTab` component

### 2. New: `src/components/onboarding-guiado/OnboardingConfigTab.tsx`
Main configuration UI with an accordion for each of the 10 steps:

- **Step 1 accordion**: Editable sections with questions/options/points + maturity thresholds table
- **Steps 2-9 accordion**: Editable title, description, icon selector, items list (add/remove/reorder)
- **Step 10 accordion**: Editable dimensions (label, icon, associated steps) + score classification thresholds

Each accordion saves independently via upsert to `onboarding_step_config`.

### 3. Update `Step1Diagnostico.tsx`
- Fetch config from `onboarding_step_config` where `step_number = 1`
- Fallback to current hardcoded values if no config exists
- Render sections/questions/options dynamically from config
- Calculate maturity using dynamic thresholds

### 4. Update `StepShell.tsx` usage in `OnboardingGuiado.tsx`
- Fetch config for steps 2-9 from `onboarding_step_config`
- Pass dynamic title/description/icon/items to StepShell (fallback to hardcoded SHELL_STEPS)

### 5. Update `Step10Score.tsx`
- Fetch config from `onboarding_step_config` where `step_number = 10`
- Use dynamic dimensions and thresholds (fallback to hardcoded)

### 6. New hook: `src/hooks/useOnboardingConfig.ts`
- Fetches all rows from `onboarding_step_config`
- Provides `getStepConfig(stepNumber)` helper
- Provides `saveStepConfig(stepNumber, config)` mutation
- Used by both backoffice config tab and wizard steps

## Files Summary
- **Migration**: 1 new table + RLS + seed 10 default rows
- **New**: `OnboardingConfigTab.tsx`, `useOnboardingConfig.ts`
- **Edit**: `BackofficeOnboarding.tsx` (add Tabs), `Step1Diagnostico.tsx` (dynamic), `Step10Score.tsx` (dynamic), `OnboardingGuiado.tsx` (dynamic shell steps)

