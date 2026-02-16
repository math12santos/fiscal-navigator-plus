
DROP POLICY IF EXISTS "Members can view fiscal groups" ON public.fiscal_groups;

CREATE POLICY "Members can view fiscal groups"
  ON public.fiscal_groups FOR SELECT
  TO authenticated
  USING (
    (is_default = true) OR is_org_member(auth.uid(), organization_id)
  );
