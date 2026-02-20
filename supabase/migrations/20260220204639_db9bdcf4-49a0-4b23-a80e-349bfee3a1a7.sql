
-- Allow masters to view ALL organizations (for backoffice)
CREATE POLICY "Masters can view all organizations"
  ON public.organizations FOR SELECT
  USING (public.has_role(auth.uid(), 'master'));
