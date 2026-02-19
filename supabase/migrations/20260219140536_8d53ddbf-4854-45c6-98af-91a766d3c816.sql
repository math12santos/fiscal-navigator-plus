
-- =====================================================
-- COMMERCIAL PLANNING MODULE
-- =====================================================

-- 1) commercial_plans — main plan config
CREATE TABLE public.commercial_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Plano Comercial',
  mode TEXT NOT NULL DEFAULT 'top_down', -- top_down | bottom_up
  period_months INTEGER NOT NULL DEFAULT 12,
  budget_approved NUMERIC NOT NULL DEFAULT 0,
  budget_requested NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | archived
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view commercial plans" ON public.commercial_plans
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create commercial plans" ON public.commercial_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update commercial plans" ON public.commercial_plans
  FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete commercial plans" ON public.commercial_plans
  FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

CREATE TRIGGER update_commercial_plans_updated_at
  BEFORE UPDATE ON public.commercial_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) commercial_budget_lines — fixed costs, variable costs, media
CREATE TABLE public.commercial_budget_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.commercial_plans(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'fixo', -- fixo | variavel | midia
  subcategory TEXT, -- equipe | software | comissao | creditos_ia | trafego_pago | publicidade
  description TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  encargos_pct NUMERIC DEFAULT 0,
  beneficios NUMERIC DEFAULT 0,
  valor_mensal NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view commercial budget lines" ON public.commercial_budget_lines
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create commercial budget lines" ON public.commercial_budget_lines
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update commercial budget lines" ON public.commercial_budget_lines
  FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete commercial budget lines" ON public.commercial_budget_lines
  FOR DELETE USING (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_commercial_budget_lines_updated_at
  BEFORE UPDATE ON public.commercial_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) commercial_channels — sales channels with funnel + projections
CREATE TABLE public.commercial_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.commercial_plans(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  orcamento_alocado NUMERIC NOT NULL DEFAULT 0,
  cpl_estimado NUMERIC DEFAULT 0,
  cpa_estimado NUMERIC DEFAULT 0,
  leads_projetados INTEGER DEFAULT 0,
  conv_lead_oportunidade NUMERIC DEFAULT 0, -- % 0-100
  conv_oportunidade_proposta NUMERIC DEFAULT 0,
  conv_proposta_fechamento NUMERIC DEFAULT 0,
  ticket_medio NUMERIC DEFAULT 0,
  ciclo_medio_dias INTEGER DEFAULT 30,
  tipo_contrato TEXT DEFAULT 'pontual', -- pontual | recorrente
  mrr NUMERIC DEFAULT 0,
  duracao_media_meses INTEGER DEFAULT 1,
  comissao_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view commercial channels" ON public.commercial_channels
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create commercial channels" ON public.commercial_channels
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update commercial channels" ON public.commercial_channels
  FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete commercial channels" ON public.commercial_channels
  FOR DELETE USING (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_commercial_channels_updated_at
  BEFORE UPDATE ON public.commercial_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) commercial_scenarios — scenario adjustments
CREATE TABLE public.commercial_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.commercial_plans(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'realista', -- conservador | realista | agressivo | personalizado
  ajuste_conversao NUMERIC DEFAULT 0, -- % adjustment
  ajuste_ticket NUMERIC DEFAULT 0,
  ajuste_cpl NUMERIC DEFAULT 0,
  ajuste_ciclo NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view commercial scenarios" ON public.commercial_scenarios
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create commercial scenarios" ON public.commercial_scenarios
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update commercial scenarios" ON public.commercial_scenarios
  FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete commercial scenarios" ON public.commercial_scenarios
  FOR DELETE USING (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_commercial_scenarios_updated_at
  BEFORE UPDATE ON public.commercial_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
