-- ============================================================
-- Expense Requests: políticas e SLAs
-- ============================================================

-- 1) Políticas de despesa/reembolso (transparência ao solicitante)
CREATE TABLE IF NOT EXISTS public.expense_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL CHECK (source_module IN ('dp','juridico','ti','crm','financeiro','cadastros')),
  subtype TEXT NOT NULL CHECK (subtype IN ('expense','reimbursement')),
  title TEXT NOT NULL,
  description TEXT,
  max_value NUMERIC(14,2),
  requires_attachment BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_policies_org_idx
  ON public.expense_policies(organization_id, source_module, subtype, active);

ALTER TABLE public.expense_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_policies_select_org_members" ON public.expense_policies
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "expense_policies_modify_admin_finance" ON public.expense_policies
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin','financeiro','master')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin','financeiro','master')
    )
  );

-- 2) SLAs por (módulo, subtype, prioridade)
CREATE TABLE IF NOT EXISTS public.request_slas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL CHECK (source_module IN ('dp','juridico','ti','crm','financeiro','cadastros')),
  subtype TEXT NOT NULL CHECK (subtype IN ('expense','reimbursement')),
  priority TEXT NOT NULL CHECK (priority IN ('baixa','media','alta','urgente')),
  sla_hours INTEGER NOT NULL CHECK (sla_hours > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_module, subtype, priority)
);

CREATE INDEX IF NOT EXISTS request_slas_org_idx
  ON public.request_slas(organization_id, source_module, subtype);

ALTER TABLE public.request_slas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request_slas_select_org_members" ON public.request_slas
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "request_slas_modify_admin_finance" ON public.request_slas
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin','financeiro','master')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin','financeiro','master')
    )
  );

-- 3) Trigger updated_at compartilhada
CREATE TRIGGER trg_expense_policies_updated
  BEFORE UPDATE ON public.expense_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_request_slas_updated
  BEFORE UPDATE ON public.request_slas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
