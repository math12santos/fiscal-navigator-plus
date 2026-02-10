
-- =============================================
-- Phase 2: Scenario Overrides (per-account/cost-center adjustments)
-- =============================================
CREATE TABLE public.scenario_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES public.planning_scenarios(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  override_type TEXT NOT NULL DEFAULT 'percentual', -- percentual | absoluto
  valor NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scenario_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view scenario overrides"
  ON public.scenario_overrides FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert scenario overrides"
  ON public.scenario_overrides FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update scenario overrides"
  ON public.scenario_overrides FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can delete scenario overrides"
  ON public.scenario_overrides FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_scenario_overrides_updated_at
  BEFORE UPDATE ON public.scenario_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Phase 3: Liabilities (debts, contingencies, provisions)
-- =============================================
CREATE TABLE public.liabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'divida', -- divida | contingencia | provisao
  descricao TEXT,
  valor_original NUMERIC NOT NULL DEFAULT 0,
  valor_atualizado NUMERIC NOT NULL DEFAULT 0,
  taxa_juros NUMERIC DEFAULT 0,
  data_inicio DATE,
  data_vencimento DATE,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo | quitado | negociacao | judicial
  probabilidade TEXT DEFAULT 'provavel', -- provavel | possivel | remota (for contingencies)
  impacto_stress NUMERIC DEFAULT 0, -- % additional impact under stress scenario
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view liabilities"
  ON public.liabilities FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert liabilities"
  ON public.liabilities FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update liabilities"
  ON public.liabilities FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can delete liabilities"
  ON public.liabilities FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_liabilities_updated_at
  BEFORE UPDATE ON public.liabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
