
-- Table to store holding (parent-child) relationships between organizations
CREATE TABLE public.organization_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subsidiary_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(holding_id, subsidiary_id),
  CHECK (holding_id != subsidiary_id)
);

ALTER TABLE public.organization_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage holdings" ON public.organization_holdings
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Org members can view holdings" ON public.organization_holdings
  FOR SELECT USING (
    is_org_member(auth.uid(), holding_id) OR is_org_member(auth.uid(), subsidiary_id)
  );
