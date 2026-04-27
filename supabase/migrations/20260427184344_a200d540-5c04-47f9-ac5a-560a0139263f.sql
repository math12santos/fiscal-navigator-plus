-- 1) Drop overly broad storage policies on contract-documents
DROP POLICY IF EXISTS "Authenticated users can upload contract files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own contract files" ON storage.objects;

-- 2) Add UPDATE policy scoped to org members
CREATE POLICY "Org members can update contract files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND ((storage.foldername(name))[1])::uuid IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'contract-documents'
  AND ((storage.foldername(name))[1])::uuid IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- 3) Restrict RPC get_user_org_ids to caller only
CREATE OR REPLACE FUNCTION public.get_user_org_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = p_user_id
    AND p_user_id = auth.uid();
$function$;

-- 4) Restrict RPC check_linked_transactions to caller only
CREATE OR REPLACE FUNCTION public.check_linked_transactions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  result := jsonb_build_object(
    'has_linked_transactions', false,
    'account_references', 0,
    'cost_center_references', 0,
    'details', jsonb_build_object()
  );

  RETURN result;
END;
$function$;