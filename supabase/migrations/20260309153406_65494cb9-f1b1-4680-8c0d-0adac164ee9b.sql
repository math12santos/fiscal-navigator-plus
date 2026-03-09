
CREATE TABLE public.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  source_type text NOT NULL DEFAULT 'spreadsheet',
  row_count integer DEFAULT 0,
  column_mapping jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  imported_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage imports" ON public.data_imports
  FOR ALL TO authenticated USING (is_org_member(auth.uid(), organization_id));

CREATE TABLE public.data_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}',
  mapped_data jsonb DEFAULT '{}',
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.data_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage import rows" ON public.data_import_rows
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM data_imports di WHERE di.id = import_id AND is_org_member(auth.uid(), di.organization_id))
  );
