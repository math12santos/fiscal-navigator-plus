
-- Onboarding Progress table
CREATE TABLE public.onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 1,
  completed_steps integer[] NOT NULL DEFAULT '{}',
  maturity_level integer DEFAULT NULL,
  maturity_score text DEFAULT NULL,
  diagnosis_answers jsonb DEFAULT '{}',
  structure_data jsonb DEFAULT '{}',
  integrations_data jsonb DEFAULT '{}',
  financial_structure_data jsonb DEFAULT '{}',
  contracts_data jsonb DEFAULT '{}',
  planning_data jsonb DEFAULT '{}',
  routines_data jsonb DEFAULT '{}',
  cockpit_activated boolean DEFAULT false,
  assisted_start_date date DEFAULT NULL,
  score_dimensions jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'em_andamento',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT NULL,
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS for onboarding_progress
CREATE POLICY "Org members can view onboarding progress"
  ON public.onboarding_progress FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert onboarding progress"
  ON public.onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update onboarding progress"
  ON public.onboarding_progress FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Masters can manage all onboarding progress"
  ON public.onboarding_progress FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role));

-- Onboarding Recommendations table
CREATE TABLE public.onboarding_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  message text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  priority text NOT NULL DEFAULT 'media'
);

ALTER TABLE public.onboarding_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view recommendations"
  ON public.onboarding_recommendations FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update recommendations"
  ON public.onboarding_recommendations FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Masters can manage all recommendations"
  ON public.onboarding_recommendations FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role));
