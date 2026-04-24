-- Sector onboarding maturity cache (per organization + sector)
CREATE TABLE public.sector_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  completeness_score NUMERIC NOT NULL DEFAULT 0,
  freshness_score NUMERIC NOT NULL DEFAULT 0,
  routines_score NUMERIC NOT NULL DEFAULT 0,
  maturity_label TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sector_onboarding_org_sector_uniq UNIQUE (organization_id, sector)
);

CREATE INDEX idx_sector_onboarding_org ON public.sector_onboarding(organization_id);
CREATE INDEX idx_sector_onboarding_sector ON public.sector_onboarding(sector);

ALTER TABLE public.sector_onboarding ENABLE ROW LEVEL SECURITY;

-- Org members: read
CREATE POLICY "Org members can view sector onboarding"
ON public.sector_onboarding
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

-- Org members: insert (must be themselves + member)
CREATE POLICY "Org members can insert sector onboarding"
ON public.sector_onboarding
FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

-- Org members: update
CREATE POLICY "Org members can update sector onboarding"
ON public.sector_onboarding
FOR UPDATE
USING (is_org_member(auth.uid(), organization_id));

-- Org admins/owners can delete
CREATE POLICY "Org admins can delete sector onboarding"
ON public.sector_onboarding
FOR DELETE
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- Backoffice access (master/admin with org access)
CREATE POLICY "Backoffice can view sector onboarding"
ON public.sector_onboarding
FOR SELECT
USING (has_backoffice_org_access(organization_id));

CREATE POLICY "Backoffice can manage sector onboarding"
ON public.sector_onboarding
FOR ALL
USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

-- Updated_at trigger
CREATE TRIGGER set_sector_onboarding_updated_at
BEFORE UPDATE ON public.sector_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();