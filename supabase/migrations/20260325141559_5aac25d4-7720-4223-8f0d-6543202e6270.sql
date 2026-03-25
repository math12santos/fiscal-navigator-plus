
-- 1. Add import_id to cashflow_entries
ALTER TABLE public.cashflow_entries
ADD COLUMN import_id UUID REFERENCES public.data_imports(id) ON DELETE SET NULL;

CREATE INDEX idx_cashflow_entries_import_id ON public.cashflow_entries(import_id);

-- 2. Create fiscal_periods table
CREATE TABLE public.fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, year_month)
);

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read
CREATE POLICY "Org members can read fiscal_periods"
ON public.fiscal_periods FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id) OR public.has_backoffice_org_access(organization_id));

-- RLS: owner/admin can insert
CREATE POLICY "Org owner/admin can insert fiscal_periods"
ON public.fiscal_periods FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR public.has_backoffice_org_access(organization_id));

-- RLS: owner/admin can update
CREATE POLICY "Org owner/admin can update fiscal_periods"
ON public.fiscal_periods FOR UPDATE TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR public.has_backoffice_org_access(organization_id));

-- RLS: owner/admin can delete
CREATE POLICY "Org owner/admin can delete fiscal_periods"
ON public.fiscal_periods FOR DELETE TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR public.has_backoffice_org_access(organization_id));
