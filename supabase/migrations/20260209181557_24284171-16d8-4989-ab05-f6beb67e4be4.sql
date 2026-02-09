
CREATE TABLE public.fiscal_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'produto' CHECK (type IN ('produto', 'servico', 'ambos')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.fiscal_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view fiscal groups" ON public.fiscal_groups
  FOR SELECT USING (is_default = true OR public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert fiscal groups" ON public.fiscal_groups
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update fiscal groups" ON public.fiscal_groups
  FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can delete fiscal groups" ON public.fiscal_groups
  FOR DELETE USING (public.is_org_member(auth.uid(), organization_id) AND is_default = false);

-- Seed default groups
INSERT INTO public.fiscal_groups (name, type, is_default, user_id) VALUES
  ('Revenda', 'produto', true, '00000000-0000-0000-0000-000000000000'),
  ('Industrialização', 'produto', true, '00000000-0000-0000-0000-000000000000'),
  ('Consumo', 'produto', true, '00000000-0000-0000-0000-000000000000'),
  ('Matéria-prima', 'produto', true, '00000000-0000-0000-0000-000000000000'),
  ('Ativo imobilizado', 'produto', true, '00000000-0000-0000-0000-000000000000'),
  ('Consultoria', 'servico', true, '00000000-0000-0000-0000-000000000000'),
  ('Manutenção', 'servico', true, '00000000-0000-0000-0000-000000000000'),
  ('Tecnologia', 'servico', true, '00000000-0000-0000-0000-000000000000'),
  ('Transporte', 'servico', true, '00000000-0000-0000-0000-000000000000'),
  ('Locação', 'ambos', true, '00000000-0000-0000-0000-000000000000');
