
-- Add must_change_password to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Create organization_modules table for per-org module enablement
CREATE TABLE public.organization_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, module_key)
);

-- Enable RLS
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org members can view org modules"
ON public.organization_modules FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can manage org modules"
ON public.organization_modules FOR INSERT
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Org admins can update org modules"
ON public.organization_modules FOR UPDATE
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Org admins can delete org modules"
ON public.organization_modules FOR DELETE
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));
