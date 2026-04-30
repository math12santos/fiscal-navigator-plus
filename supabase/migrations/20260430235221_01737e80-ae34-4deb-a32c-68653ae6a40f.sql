-- =========================================================
-- FASE 1 — Fundação de Billing & Gestão do SaaS no Backoffice
-- =========================================================

-- 1) Catálogo de planos
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  trial_days integer NOT NULL DEFAULT 14,
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_plans backoffice all"
  ON public.billing_plans FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "billing_plans public read active"
  ON public.billing_plans FOR SELECT TO authenticated
  USING (is_active = true AND is_public = true);

CREATE TRIGGER trg_billing_plans_updated
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Assinaturas por organização
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','yearly')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,
  paused_at timestamptz,
  seats integer NOT NULL DEFAULT 1,
  custom_price numeric(12,2),
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'manual'
    CHECK (payment_method IN ('manual','pix','boleto','card','stripe','paddle')),
  external_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE INDEX idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions backoffice all"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "subscriptions org admins read"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = subscriptions.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Faturas
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  number text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at date NOT NULL,
  paid_at timestamptz,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft','open','paid','overdue','void')),
  pdf_url text,
  payment_link text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due ON public.invoices(due_at);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices backoffice all"
  ON public.invoices FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "invoices org admins read"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = invoices.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Linhas de fatura
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  kind text NOT NULL DEFAULT 'subscription'
    CHECK (kind IN ('subscription','addon','credit','discount','adjustment','overage')),
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items backoffice all"
  ON public.invoice_items FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "invoice_items org admins read"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      JOIN public.organization_members m ON m.organization_id = i.organization_id
      WHERE i.id = invoice_items.invoice_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

-- 5) Métricas de uso (snapshot diário)
CREATE TABLE public.usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT current_date,
  users_count integer NOT NULL DEFAULT 0,
  active_users_30d integer NOT NULL DEFAULT 0,
  employees_count integer NOT NULL DEFAULT 0,
  contracts_count integer NOT NULL DEFAULT 0,
  cashflow_entries_count integer NOT NULL DEFAULT 0,
  ai_credits_used integer NOT NULL DEFAULT 0,
  storage_mb numeric(12,2) NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, metric_date)
);

CREATE INDEX idx_usage_metrics_org_date ON public.usage_metrics(organization_id, metric_date DESC);

ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_metrics backoffice all"
  ON public.usage_metrics FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "usage_metrics org admins read"
  ON public.usage_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = usage_metrics.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

-- 6) Feature flags
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','org','plan')),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  rollout_pct integer NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag_key, scope, organization_id, plan_id)
);

CREATE INDEX idx_feature_flags_key ON public.feature_flags(flag_key);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags backoffice all"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "feature_flags read all auth"
  ON public.feature_flags FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_feature_flags_updated
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Tickets de suporte
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL,
  subject text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting_customer','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  category text,
  channel text NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app','email','chat','phone')),
  assigned_to uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_org ON public.support_tickets(organization_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_opened_by ON public.support_tickets(opened_by);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets backoffice all"
  ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "support_tickets opener read"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (opened_by = auth.uid());

CREATE POLICY "support_tickets opener insert"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid());

CREATE POLICY "support_tickets org admins read"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = support_tickets.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Mensagens dos tickets
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_messages_ticket ON public.support_ticket_messages(ticket_id);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_messages backoffice all"
  ON public.support_ticket_messages FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "ticket_messages author read"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    is_internal = false AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND t.opened_by = auth.uid()
    )
  );

CREATE POLICY "ticket_messages author insert"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND is_internal = false AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND t.opened_by = auth.uid()
    )
  );

-- 9) Anúncios da plataforma
CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','success','warning','critical')),
  audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all','plan','org')),
  plan_id uuid REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  dismissible boolean NOT NULL DEFAULT true,
  cta_label text,
  cta_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements backoffice all"
  ON public.platform_announcements FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE POLICY "announcements public read active"
  ON public.platform_announcements FOR SELECT TO authenticated
  USING (
    starts_at <= now() AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE TRIGGER trg_announcements_updated
  BEFORE UPDATE ON public.platform_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10) Notas internas por org (CRM-like, só backoffice)
CREATE TABLE public.org_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_notes_org ON public.org_notes(organization_id);

ALTER TABLE public.org_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_notes backoffice all"
  ON public.org_notes FOR ALL TO authenticated
  USING (public.is_backoffice()) WITH CHECK (public.is_backoffice());

CREATE TRIGGER trg_org_notes_updated
  BEFORE UPDATE ON public.org_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11) Campos de saúde em organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_score smallint;

CREATE INDEX IF NOT EXISTS idx_organizations_last_active ON public.organizations(last_active_at);

-- 12) Seed de planos iniciais
INSERT INTO public.billing_plans (code, name, description, price_monthly, price_yearly, trial_days, sort_order, limits, modules)
VALUES
  ('starter', 'Starter', 'Para times pequenos começando a estruturar a operação financeira.',
   297.00, 2970.00, 14, 1,
   '{"max_users":5,"max_employees":20,"max_contracts":50,"ai_credits_month":100,"max_orgs_holding":1,"storage_mb":1024}'::jsonb,
   '["dashboard","fluxo-caixa","contratos","dp"]'::jsonb),
  ('growth', 'Growth', 'Para empresas em crescimento com necessidade de planejamento e governança.',
   897.00, 8970.00, 14, 2,
   '{"max_users":25,"max_employees":100,"max_contracts":300,"ai_credits_month":1000,"max_orgs_holding":3,"storage_mb":10240}'::jsonb,
   '["dashboard","fluxo-caixa","contratos","planejamento","dp","conciliacao","tarefas","ia-financeira"]'::jsonb),
  ('enterprise', 'Enterprise', 'Para holdings e operações multi-empresa com governança completa.',
   2497.00, 24970.00, 30, 3,
   '{"max_users":-1,"max_employees":-1,"max_contracts":-1,"ai_credits_month":-1,"max_orgs_holding":-1,"storage_mb":-1}'::jsonb,
   '["dashboard","fluxo-caixa","contratos","planejamento","dp","conciliacao","tarefas","ia-financeira","integracoes","documentos","configuracoes"]'::jsonb);
