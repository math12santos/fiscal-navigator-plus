
-- Fix it-attachments storage policies: use objects.name (the storage path), not o.name (org name)
DROP POLICY IF EXISTS it_att_select ON storage.objects;
DROP POLICY IF EXISTS it_att_insert ON storage.objects;
DROP POLICY IF EXISTS it_att_delete ON storage.objects;

CREATE POLICY it_att_select ON storage.objects
FOR SELECT
USING (
  bucket_id = 'it-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE (o.id)::text = (storage.foldername(objects.name))[1]
        AND public.is_org_member(auth.uid(), o.id)
    )
    OR public.has_backoffice_role(ARRAY['master','backoffice_admin'])
  )
);

CREATE POLICY it_att_insert ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'it-attachments'
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE (o.id)::text = (storage.foldername(objects.name))[1]
      AND public.is_org_member(auth.uid(), o.id)
  )
);

CREATE POLICY it_att_delete ON storage.objects
FOR DELETE
USING (
  bucket_id = 'it-attachments'
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE (o.id)::text = (storage.foldername(objects.name))[1]
      AND public.is_org_member(auth.uid(), o.id)
  )
);

-- purchase_code_seq: explicit deny-all policy (table is only used by SECURITY DEFINER functions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'purchase_code_seq' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS purchase_code_seq_no_direct_access ON public.purchase_code_seq';
    EXECUTE 'CREATE POLICY purchase_code_seq_no_direct_access ON public.purchase_code_seq FOR ALL USING (false) WITH CHECK (false)';
  END IF;
END $$;
