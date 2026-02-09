
-- Fix: allow creator to see their org (needed for insert().select())
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;

CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR is_org_member(auth.uid(), id)
);
