
-- Create user_permissions table for module/tab access control
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module text NOT NULL,
  tab text DEFAULT NULL,
  allowed boolean NOT NULL DEFAULT true,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, module, tab)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Masters can do everything
CREATE POLICY "Masters can manage all permissions"
  ON public.user_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'master'));

-- Org owners/admins can manage permissions for their org
CREATE POLICY "Org admins can manage permissions"
  ON public.user_permissions FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if user has module access
CREATE OR REPLACE FUNCTION public.has_module_access(p_user_id uuid, p_org_id uuid, p_module text, p_tab text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Masters always have access
    CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'master') THEN true
    -- Check specific permission
    WHEN p_tab IS NOT NULL THEN
      EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND organization_id = p_org_id AND module = p_module AND tab = p_tab AND allowed = true)
    ELSE
      EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND organization_id = p_org_id AND module = p_module AND tab IS NULL AND allowed = true)
    END;
$$;
