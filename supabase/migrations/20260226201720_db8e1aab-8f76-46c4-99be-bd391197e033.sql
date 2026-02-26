
-- Create cost_center_permissions table
CREATE TABLE public.cost_center_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  tab_key text,
  role text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Unique index using COALESCE for nullable tab_key
CREATE UNIQUE INDEX uq_cc_perm_module_tab_role
ON public.cost_center_permissions (cost_center_id, module_key, COALESCE(tab_key, '__module__'), role);

-- Enable RLS
ALTER TABLE public.cost_center_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can view
CREATE POLICY "Org members can view cc permissions"
ON public.cost_center_permissions
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

-- INSERT: owners/admins only
CREATE POLICY "Org admins can create cc permissions"
ON public.cost_center_permissions
FOR INSERT
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

-- UPDATE: owners/admins only
CREATE POLICY "Org admins can update cc permissions"
ON public.cost_center_permissions
FOR UPDATE
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

-- DELETE: owners/admins only
CREATE POLICY "Org admins can delete cc permissions"
ON public.cost_center_permissions
FOR DELETE
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));
