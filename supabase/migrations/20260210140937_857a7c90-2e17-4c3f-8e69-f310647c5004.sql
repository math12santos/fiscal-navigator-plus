
-- =============================================
-- MÓDULO DE PLANEJAMENTO FINANCEIRO - FASE 1
-- =============================================

-- 1. Versões de Orçamento (versionamento obrigatório)
CREATE TABLE public.budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, approved, archived
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view budget versions" ON public.budget_versions
  FOR SELECT USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create budget versions" ON public.budget_versions
  FOR INSERT WITH CHECK (
    (auth.uid() = user_id) AND 
    (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update budget versions" ON public.budget_versions
  FOR UPDATE USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Org admins can delete budget versions" ON public.budget_versions
  FOR DELETE USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']))
  );

CREATE TRIGGER update_budget_versions_updated_at
  BEFORE UPDATE ON public.budget_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Linhas de Orçamento (valores mensais por conta/centro)
CREATE TABLE public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id uuid NOT NULL REFERENCES public.budget_versions(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.chart_of_accounts(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  month date NOT NULL, -- primeiro dia do mês
  tipo text NOT NULL DEFAULT 'despesa', -- receita, custo, despesa
  natureza text NOT NULL DEFAULT 'fixo', -- fixo, variavel, hibrido
  valor_orcado numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view budget lines" ON public.budget_lines
  FOR SELECT USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create budget lines" ON public.budget_lines
  FOR INSERT WITH CHECK (
    (auth.uid() = user_id) AND 
    (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update budget lines" ON public.budget_lines
  FOR UPDATE USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Org admins can delete budget lines" ON public.budget_lines
  FOR DELETE USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']))
  );

CREATE TRIGGER update_budget_lines_updated_at
  BEFORE UPDATE ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_budget_lines_version ON public.budget_lines(budget_version_id);
CREATE INDEX idx_budget_lines_month ON public.budget_lines(month);
CREATE INDEX idx_budget_lines_account ON public.budget_lines(account_id);
CREATE INDEX idx_budget_lines_cost_center ON public.budget_lines(cost_center_id);

-- 3. Cenários de Planejamento
CREATE TABLE public.planning_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'base', -- base, otimista, conservador, stress, custom
  description text,
  is_active boolean NOT NULL DEFAULT true,
  variacao_receita numeric DEFAULT 0,
  variacao_custos numeric DEFAULT 0,
  atraso_recebimento_dias integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planning_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scenarios" ON public.planning_scenarios
  FOR SELECT USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create scenarios" ON public.planning_scenarios
  FOR INSERT WITH CHECK (
    (auth.uid() = user_id) AND 
    (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update scenarios" ON public.planning_scenarios
  FOR UPDATE USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Org admins can delete scenarios" ON public.planning_scenarios
  FOR DELETE USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']))
  );

CREATE TRIGGER update_planning_scenarios_updated_at
  BEFORE UPDATE ON public.planning_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Configurações de Planejamento (saldo mínimo, liquidez)
CREATE TABLE public.planning_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  saldo_minimo numeric DEFAULT 0,
  colchao_liquidez numeric DEFAULT 0,
  runway_alerta_meses integer DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.planning_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view config" ON public.planning_config
  FOR SELECT USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create config" ON public.planning_config
  FOR INSERT WITH CHECK (
    (auth.uid() = user_id) AND 
    (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update config" ON public.planning_config
  FOR UPDATE USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );
