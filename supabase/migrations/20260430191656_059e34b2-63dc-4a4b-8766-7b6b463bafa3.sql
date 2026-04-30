-- Tabela de preferências de KPIs do Dashboard Financeiro (por usuário + organização)
CREATE TABLE public.dashboard_kpi_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  kpi_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, kpi_id)
);

CREATE INDEX idx_dashboard_kpi_pref_lookup
  ON public.dashboard_kpi_preferences (user_id, organization_id);

ALTER TABLE public.dashboard_kpi_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own KPI prefs in their orgs"
  ON public.dashboard_kpi_preferences FOR SELECT
  USING (
    auth.uid() = user_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Users insert own KPI prefs in their orgs"
  ON public.dashboard_kpi_preferences FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Users update own KPI prefs in their orgs"
  ON public.dashboard_kpi_preferences FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Users delete own KPI prefs in their orgs"
  ON public.dashboard_kpi_preferences FOR DELETE
  USING (
    auth.uid() = user_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE TRIGGER trg_dashboard_kpi_pref_updated_at
  BEFORE UPDATE ON public.dashboard_kpi_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();