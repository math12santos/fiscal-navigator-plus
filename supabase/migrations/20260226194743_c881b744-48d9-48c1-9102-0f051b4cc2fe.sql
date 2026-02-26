
-- Tabela de associação usuário <-> centro de custo
CREATE TABLE public.user_cost_center_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, cost_center_id)
);

-- Enable RLS
ALTER TABLE public.user_cost_center_access ENABLE ROW LEVEL SECURITY;

-- Membros da organização podem visualizar
CREATE POLICY "Org members can view cost center access"
ON public.user_cost_center_access
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

-- Owners/admins podem inserir
CREATE POLICY "Org admins can insert cost center access"
ON public.user_cost_center_access
FOR INSERT
WITH CHECK (
  has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  OR has_role(auth.uid(), 'master')
);

-- Owners/admins podem deletar
CREATE POLICY "Org admins can delete cost center access"
ON public.user_cost_center_access
FOR DELETE
USING (
  has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  OR has_role(auth.uid(), 'master')
);
