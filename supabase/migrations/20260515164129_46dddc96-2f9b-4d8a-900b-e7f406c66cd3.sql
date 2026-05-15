DROP POLICY IF EXISTS "Org admins can delete positions" ON public.positions;
CREATE POLICY "Admins or creator can delete positions"
  ON public.positions FOR DELETE
  USING (
    has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
    OR auth.uid() = user_id
  );