
-- Drop ALL existing storage policies for contract-documents
DROP POLICY IF EXISTS "Org members can view contract files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload contract files" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can delete contract files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload contract documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view contract documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete contract documents" ON storage.objects;

-- Recreate with organization isolation
CREATE POLICY "Org members can view contract files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contract-documents' AND
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can upload contract files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contract-documents' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can delete contract files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contract-documents' AND
    (storage.foldername(name))[1]::uuid IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );
