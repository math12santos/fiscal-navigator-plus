-- 1. Calendário de dias úteis por mês (override organizacional)
CREATE TABLE public.dp_business_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  business_days INTEGER NOT NULL CHECK (business_days >= 0 AND business_days <= 31),
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference_month)
);

ALTER TABLE public.dp_business_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view business days"
  ON public.dp_business_days FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "org members can insert business days"
  ON public.dp_business_days FOR INSERT
  WITH CHECK ((is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)) AND auth.uid() = user_id);

CREATE POLICY "org members can update business days"
  ON public.dp_business_days FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "org members can delete business days"
  ON public.dp_business_days FOR DELETE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER update_dp_business_days_updated_at
  BEFORE UPDATE ON public.dp_business_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dp_business_days_org_month ON public.dp_business_days(organization_id, reference_month);

-- 2. Override individual por colaborador dentro de uma rodada de folha
CREATE TABLE public.payroll_business_days_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  business_days_used INTEGER NOT NULL CHECK (business_days_used >= 0 AND business_days_used <= 31),
  reason TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

ALTER TABLE public.payroll_business_days_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view payroll day overrides"
  ON public.payroll_business_days_overrides FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "org members can insert payroll day overrides"
  ON public.payroll_business_days_overrides FOR INSERT
  WITH CHECK ((is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)) AND auth.uid() = user_id);

CREATE POLICY "org members can update payroll day overrides"
  ON public.payroll_business_days_overrides FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "org members can delete payroll day overrides"
  ON public.payroll_business_days_overrides FOR DELETE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER update_payroll_business_days_overrides_updated_at
  BEFORE UPDATE ON public.payroll_business_days_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payroll_day_overrides_run ON public.payroll_business_days_overrides(payroll_run_id);
CREATE INDEX idx_payroll_day_overrides_emp ON public.payroll_business_days_overrides(employee_id);

-- 3. Documentar valores aceitos em dp_benefits.type
COMMENT ON COLUMN public.dp_benefits.type IS 'Tipo de cálculo do benefício: fixo (valor mensal fixo), percentual (% do salário base), por_dia (valor diário × dias úteis efetivos do mês)';