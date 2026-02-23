
-- Benefits catalog per organization
CREATE TABLE public.dp_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixo', -- fixo, percentual
  default_value NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dp_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view dp benefits" ON public.dp_benefits FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create dp benefits" ON public.dp_benefits FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update dp benefits" ON public.dp_benefits FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete dp benefits" ON public.dp_benefits FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- Employee-benefit assignments
CREATE TABLE public.employee_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  benefit_id UUID NOT NULL REFERENCES public.dp_benefits(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  custom_value NUMERIC, -- override the default value if needed
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, benefit_id)
);

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view employee benefits" ON public.employee_benefits FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create employee benefits" ON public.employee_benefits FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update employee benefits" ON public.employee_benefits FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete employee benefits" ON public.employee_benefits FOR DELETE USING (is_org_member(auth.uid(), organization_id));

-- Add commission fields to employees
ALTER TABLE public.employees ADD COLUMN comissao_tipo TEXT DEFAULT 'nenhuma'; -- nenhuma, percentual, valor_fixo
ALTER TABLE public.employees ADD COLUMN comissao_valor NUMERIC DEFAULT 0;
