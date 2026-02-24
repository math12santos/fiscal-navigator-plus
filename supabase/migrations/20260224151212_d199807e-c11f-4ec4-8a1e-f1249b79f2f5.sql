-- Allow masters to delete organizations
CREATE POLICY "Masters can delete organizations"
ON public.organizations
FOR DELETE
USING (has_role(auth.uid(), 'master'::app_role));