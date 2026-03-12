
-- Create grouping_rules table
CREATE TABLE public.grouping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  match_field text NOT NULL DEFAULT 'categoria',
  match_value text NOT NULL,
  sub_group_field text,
  min_items int NOT NULL DEFAULT 2,
  enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.grouping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org grouping rules"
  ON public.grouping_rules FOR SELECT
  TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    OR has_backoffice_org_access(organization_id)
  );

CREATE POLICY "Members can insert org grouping rules"
  ON public.grouping_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      is_org_member(auth.uid(), organization_id)
      OR has_backoffice_org_access(organization_id)
    )
  );

CREATE POLICY "Members can update org grouping rules"
  ON public.grouping_rules FOR UPDATE
  TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    OR has_backoffice_org_access(organization_id)
  )
  WITH CHECK (
    is_org_member(auth.uid(), organization_id)
    OR has_backoffice_org_access(organization_id)
  );

CREATE POLICY "Members can delete org grouping rules"
  ON public.grouping_rules FOR DELETE
  TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    OR has_backoffice_org_access(organization_id)
  );

-- Trigger for updated_at
CREATE TRIGGER set_grouping_rules_updated_at
  BEFORE UPDATE ON public.grouping_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
