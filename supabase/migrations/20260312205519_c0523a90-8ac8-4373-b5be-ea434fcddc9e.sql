
-- Add missing columns to request_attachments
ALTER TABLE public.request_attachments
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS file_type text NOT NULL DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0;

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-attachments', 'request-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Org members can upload request attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'request-attachments'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Org members can read request attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Users can delete own request attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND auth.uid()::text = (storage.foldername(name))[3]
  );
