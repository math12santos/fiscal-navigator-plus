-- Histórico de exportações de PDF do Planejamento (apenas metadados; PDF é regerado on-demand)
CREATE TABLE public.planning_report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  report_type text NOT NULL DEFAULT 'planning_cockpit',
  scenario_id uuid REFERENCES public.commercial_scenarios(id) ON DELETE SET NULL,
  scenario_name text,
  budget_version_id uuid REFERENCES public.budget_versions(id) ON DELETE SET NULL,
  budget_version_name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  filters_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_planning_report_exports_org_user
  ON public.planning_report_exports (organization_id, user_id, created_at DESC);

ALTER TABLE public.planning_report_exports ENABLE ROW LEVEL SECURITY;

-- Visibilidade: apenas o autor (dentro de uma org da qual ele é membro)
CREATE POLICY "Users see their own planning exports"
  ON public.planning_report_exports FOR SELECT
  USING (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users insert their own planning exports"
  ON public.planning_report_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users delete their own planning exports"
  ON public.planning_report_exports FOR DELETE
  USING (auth.uid() = user_id);