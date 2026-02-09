
-- ============================================
-- MULTI-ORGANIZATION SUPPORT
-- ============================================

-- 1. Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'CNPJ',
  document_number TEXT NOT NULL,
  logo_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_number)
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Organization members table
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 3. Security definer functions (bypass RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id AND organization_id = p_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_user_id UUID, p_org_id UUID, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id AND organization_id = p_org_id AND role = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = p_user_id;
$$;

-- 4. RLS for organizations
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Org owners/admins can update"
  ON public.organizations FOR UPDATE
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner', 'admin']));

CREATE POLICY "Org owners can delete"
  ON public.organizations FOR DELETE
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner']));

-- 5. RLS for organization_members
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can insert themselves or admins can add"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "Org owners/admins can update members"
  ON public.organization_members FOR UPDATE
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Org owners can remove members or self-leave"
  ON public.organization_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.has_org_role(auth.uid(), organization_id, ARRAY['owner'])
  );

-- 6. Add organization_id to existing tables (nullable for backward compat)
ALTER TABLE public.chart_of_accounts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.cost_centers ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.contracts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.audit_log ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.plan_migrations ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- 7. Update RLS on existing tables to also check org membership
-- Drop old policies and create new ones that check both user_id and org membership

-- chart_of_accounts
DROP POLICY IF EXISTS "Users can view own accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can create own accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.chart_of_accounts;

CREATE POLICY "Org members can view accounts"
  ON public.chart_of_accounts FOR SELECT
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create accounts"
  ON public.chart_of_accounts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update accounts"
  ON public.chart_of_accounts FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Org members can delete accounts"
  ON public.chart_of_accounts FOR DELETE
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']))
  );

-- cost_centers
DROP POLICY IF EXISTS "Users can view own cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Users can create own cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Users can update own cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Users can delete own cost centers" ON public.cost_centers;

CREATE POLICY "Org members can view cost centers"
  ON public.cost_centers FOR SELECT
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create cost centers"
  ON public.cost_centers FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update cost centers"
  ON public.cost_centers FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Org members can delete cost centers"
  ON public.cost_centers FOR DELETE
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']))
  );

-- contracts
DROP POLICY IF EXISTS "Users can view own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can create own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can delete own contracts" ON public.contracts;

CREATE POLICY "Org members can view contracts"
  ON public.contracts FOR SELECT
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update contracts"
  ON public.contracts FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Org members can delete contracts"
  ON public.contracts FOR DELETE
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']))
  );

-- audit_log (keep user-level + org)
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;

CREATE POLICY "Users can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view audit logs"
  ON public.audit_log FOR SELECT
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
  );

-- plan_migrations
DROP POLICY IF EXISTS "Users can view own migrations" ON public.plan_migrations;
DROP POLICY IF EXISTS "Users can create own migrations" ON public.plan_migrations;
DROP POLICY IF EXISTS "Users can update own migrations" ON public.plan_migrations;
DROP POLICY IF EXISTS "Users can delete own migrations" ON public.plan_migrations;

CREATE POLICY "Users can view migrations"
  ON public.plan_migrations FOR SELECT
  USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Users can create migrations"
  ON public.plan_migrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update migrations"
  ON public.plan_migrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete migrations"
  ON public.plan_migrations FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Add indexes
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_chart_accounts_org ON public.chart_of_accounts(organization_id);
CREATE INDEX idx_cost_centers_org ON public.cost_centers(organization_id);
CREATE INDEX idx_contracts_org ON public.contracts(organization_id);
