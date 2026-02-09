
-- Drop restrictive INSERT policies
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can insert themselves or admins can add" ON public.organization_members;

-- Recreate as PERMISSIVE
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can insert themselves or admins can add"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
);
