
-- ================================================
-- Backoffice Authorization Layer
-- ================================================

-- PART 1: Create backoffice tables

CREATE TABLE IF NOT EXISTS public.backoffice_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'backoffice_operator' CHECK (role IN ('master','backoffice_admin','backoffice_operator','auditor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backoffice_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage backoffice users" ON public.backoffice_users
  FOR ALL USING (has_role(auth.uid(), 'master'));

CREATE POLICY "Backoffice users can view self" ON public.backoffice_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.backoffice_organization_access (
  user_id uuid NOT NULL REFERENCES public.backoffice_users(user_id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'managed',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

ALTER TABLE public.backoffice_organization_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters manage backoffice org access" ON public.backoffice_organization_access
  FOR ALL USING (has_role(auth.uid(), 'master'));

CREATE POLICY "Backoffice admins manage assignments" ON public.backoffice_organization_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.backoffice_users bu WHERE bu.user_id = auth.uid() AND bu.is_active AND bu.role IN ('master', 'backoffice_admin'))
  );

CREATE POLICY "Backoffice users view own access" ON public.backoffice_organization_access
  FOR SELECT USING (auth.uid() = user_id);

-- PART 2: Helper functions (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.is_backoffice()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.backoffice_users
    WHERE user_id = auth.uid() AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_backoffice_role(_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.backoffice_users
    WHERE user_id = auth.uid() AND is_active = true AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_backoffice_org_access(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.backoffice_users bu
    WHERE bu.user_id = auth.uid() AND bu.is_active = true
    AND (
      bu.role IN ('master', 'backoffice_admin')
      OR EXISTS (
        SELECT 1 FROM public.backoffice_organization_access boa
        WHERE boa.user_id = bu.user_id AND boa.organization_id = _org_id
      )
    )
  )
$$;

-- PART 3: Add actor_type to audit_log
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'org_user';

-- PART 4: Remove duplicate INSERT policy on organization_members
DROP POLICY IF EXISTS "Users can insert themselves or admins can add" ON public.organization_members;

-- PART 5: Unique index for RPCs
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique_user_org ON public.organization_members (organization_id, user_id);

-- PART 6: Secure RPCs

CREATE OR REPLACE FUNCTION public.invite_org_member(_org_id uuid, _user_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'master') OR has_org_role(auth.uid(), _org_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin'])) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF _role = 'owner' AND NOT (has_role(auth.uid(), 'master') OR has_org_role(auth.uid(), _org_id, ARRAY['owner'])) THEN
    RAISE EXCEPTION 'Apenas owners podem promover a owner';
  END IF;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _user_id, _role)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_org_member_role(_org_id uuid, _target_user_id uuid, _new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'master') OR has_org_role(auth.uid(), _org_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin'])) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF _new_role = 'owner' AND NOT (has_role(auth.uid(), 'master') OR has_org_role(auth.uid(), _org_id, ARRAY['owner'])) THEN
    RAISE EXCEPTION 'Apenas owners podem promover a owner';
  END IF;
  UPDATE public.organization_members SET role = _new_role
  WHERE organization_id = _org_id AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_org_member(_org_id uuid, _target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    auth.uid() = _target_user_id
    OR has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), _org_id, ARRAY['owner'])
    OR has_backoffice_role(ARRAY['master','backoffice_admin'])
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  DELETE FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_backoffice_operator_to_org(_target_user_id uuid, _org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_backoffice_role(ARRAY['master','backoffice_admin']) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  INSERT INTO public.backoffice_organization_access (user_id, organization_id)
  VALUES (_target_user_id, _org_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- PART 7: Add backoffice access policies to ALL data tables

-- organization_members
CREATE POLICY "Backoffice can view org members" ON public.organization_members
  FOR SELECT USING (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice admins can insert org members" ON public.organization_members
  FOR INSERT WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']));
CREATE POLICY "Backoffice admins can update org members" ON public.organization_members
  FOR UPDATE USING (has_backoffice_role(ARRAY['master','backoffice_admin']));
CREATE POLICY "Backoffice admins can delete org members" ON public.organization_members
  FOR DELETE USING (has_backoffice_role(ARRAY['master','backoffice_admin']));

-- organizations
CREATE POLICY "Backoffice can view organizations" ON public.organizations
  FOR SELECT USING (has_backoffice_org_access(id));
CREATE POLICY "Backoffice admins can update organizations" ON public.organizations
  FOR UPDATE USING (has_backoffice_role(ARRAY['master','backoffice_admin']));

-- organization_holdings
CREATE POLICY "Backoffice can view holdings" ON public.organization_holdings
  FOR SELECT USING (has_backoffice_org_access(holding_id) OR has_backoffice_org_access(subsidiary_id));

-- organization_modules
CREATE POLICY "Backoffice can manage org modules" ON public.organization_modules
  FOR ALL USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

-- profiles (backoffice can view profiles of org members they manage)
CREATE POLICY "Backoffice can view org member profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = profiles.id AND has_backoffice_org_access(om.organization_id)
    )
  );
CREATE POLICY "Backoffice admins can update profiles" ON public.profiles
  FOR UPDATE USING (has_backoffice_role(ARRAY['master','backoffice_admin']));

-- user_permissions
CREATE POLICY "Backoffice can manage permissions" ON public.user_permissions
  FOR ALL USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

-- user_cost_center_access
CREATE POLICY "Backoffice can manage cc access" ON public.user_cost_center_access
  FOR ALL USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

-- cost_center_permissions
CREATE POLICY "Backoffice can manage cc perms" ON public.cost_center_permissions
  FOR ALL USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

-- audit_log
CREATE POLICY "Backoffice can view audit logs" ON public.audit_log
  FOR SELECT USING (organization_id IS NOT NULL AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice can insert audit logs" ON public.audit_log
  FOR INSERT WITH CHECK (is_backoffice());

-- notifications
CREATE POLICY "Backoffice can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (has_backoffice_org_access(organization_id));

-- Standard data tables (full backoffice access)
CREATE POLICY "Backoffice access budget_lines" ON public.budget_lines
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access budget_versions" ON public.budget_versions
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access cashflow_entries" ON public.cashflow_entries
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access chart_of_accounts" ON public.chart_of_accounts
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access cost_centers" ON public.cost_centers
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access entities" ON public.entities
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access products" ON public.products
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access liabilities" ON public.liabilities
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access scenario_overrides" ON public.scenario_overrides
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access commercial_channels" ON public.commercial_channels
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access commercial_plans" ON public.commercial_plans
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access commercial_scenarios" ON public.commercial_scenarios
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access commercial_budget_lines" ON public.commercial_budget_lines
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access contract_adjustments" ON public.contract_adjustments
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access contract_documents" ON public.contract_documents
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access contract_installments" ON public.contract_installments
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access crm_activities" ON public.crm_activities
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access crm_clients" ON public.crm_clients
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access crm_opportunities" ON public.crm_opportunities
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access crm_pipeline_stages" ON public.crm_pipeline_stages
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access dp_benefits" ON public.dp_benefits
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access dp_config" ON public.dp_config
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access fiscal_groups" ON public.fiscal_groups
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access hr_planning_items" ON public.hr_planning_items
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access onboarding_progress" ON public.onboarding_progress
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access onboarding_recommendations" ON public.onboarding_recommendations
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access requests" ON public.requests
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access request_tasks" ON public.request_tasks
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice access data_imports" ON public.data_imports
  FOR ALL USING (has_backoffice_org_access(organization_id)) WITH CHECK (has_backoffice_org_access(organization_id));

-- Sensitive tables (master + backoffice_admin only)
CREATE POLICY "Backoffice restricted employees" ON public.employees
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice restricted payroll_runs" ON public.payroll_runs
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice restricted payroll_items" ON public.payroll_items
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice restricted employee_vacations" ON public.employee_vacations
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice restricted contracts" ON public.contracts
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice restricted employee_benefits" ON public.employee_benefits
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice restricted employee_compensations" ON public.employee_compensations
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));
CREATE POLICY "Backoffice restricted employee_terminations" ON public.employee_terminations
  FOR ALL USING (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']) AND has_backoffice_org_access(organization_id));

-- Cross-table policies
CREATE POLICY "Backoffice access request_comments" ON public.request_comments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND has_backoffice_org_access(r.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND has_backoffice_org_access(r.organization_id))
  );

CREATE POLICY "Backoffice access request_attachments" ON public.request_attachments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND has_backoffice_org_access(r.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND has_backoffice_org_access(r.organization_id))
  );

CREATE POLICY "Backoffice access data_import_rows" ON public.data_import_rows
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.data_imports di WHERE di.id = import_id AND has_backoffice_org_access(di.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.data_imports di WHERE di.id = import_id AND has_backoffice_org_access(di.organization_id))
  );
