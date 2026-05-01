-- =========================================================
-- FASE 4 — Health Score, Governança e LGPD
-- =========================================================

-- ---------- 1. platform_settings (key/value) ----------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings backoffice all" ON public.platform_settings;
CREATE POLICY "platform_settings backoffice all"
  ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_backoffice())
  WITH CHECK (public.is_backoffice());

-- Seeds defaults (idempotent)
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('retention.canceled_org_days', '90'::jsonb, 'Dias para purgar org cancelada (soft-delete → hard-delete)'),
  ('retention.audit_log_days', '365'::jsonb, 'Dias para manter audit_log antes de purgar'),
  ('security.min_password_length', '8'::jsonb, 'Tamanho mínimo da senha'),
  ('security.require_2fa_plans', '[]'::jsonb, 'Lista de plan codes que exigem 2FA'),
  ('security.session_max_hours', '24'::jsonb, 'Tempo máximo de sessão em horas'),
  ('webhooks.signup_url', '""'::jsonb, 'URL de webhook acionado em novo signup'),
  ('webhooks.cancellation_url', '""'::jsonb, 'URL de webhook acionado em cancelamento'),
  ('lgpd.dpo_email', '""'::jsonb, 'E-mail do encarregado de proteção de dados (DPO)')
ON CONFLICT (key) DO NOTHING;

-- ---------- 2. email_templates ----------
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates backoffice all" ON public.email_templates;
CREATE POLICY "email_templates backoffice all"
  ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_backoffice())
  WITH CHECK (public.is_backoffice());

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seeds (idempotent)
INSERT INTO public.email_templates (template_key, name, subject, body_html, variables) VALUES
  ('welcome', 'Boas-vindas',
   'Bem-vindo(a) ao {{platform_name}}!',
   '<p>Olá {{user_name}},</p><p>Sua conta na <strong>{{platform_name}}</strong> foi criada com sucesso.</p><p>Acesse: <a href="{{login_url}}">{{login_url}}</a></p>',
   '["user_name","platform_name","login_url"]'::jsonb),
  ('invoice_issued', 'Fatura emitida',
   'Sua fatura {{invoice_number}} foi emitida',
   '<p>Olá {{org_name}},</p><p>Emitimos a fatura <strong>{{invoice_number}}</strong> no valor de <strong>{{amount}}</strong>, com vencimento em <strong>{{due_date}}</strong>.</p><p><a href="{{payment_link}}">Pagar agora</a></p>',
   '["org_name","invoice_number","amount","due_date","payment_link"]'::jsonb),
  ('invoice_overdue', 'Fatura vencida',
   'Atenção: fatura {{invoice_number}} está vencida',
   '<p>A fatura <strong>{{invoice_number}}</strong> ({{amount}}) venceu em {{due_date}} e ainda não foi quitada. Regularize para evitar suspensão.</p>',
   '["invoice_number","amount","due_date"]'::jsonb),
  ('trial_expiring', 'Trial expirando',
   'Seu período de avaliação termina em {{days_left}} dias',
   '<p>Olá {{org_name}}, faltam <strong>{{days_left}} dias</strong> para o fim do trial. Escolha um plano para continuar usando.</p>',
   '["org_name","days_left"]'::jsonb),
  ('suspension', 'Conta suspensa',
   'Sua conta foi suspensa',
   '<p>Sua conta foi suspensa por inadimplência. Quite a fatura em aberto para reativar.</p>',
   '[]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- ---------- 3. compute_health_score(org_id) ----------
CREATE OR REPLACE FUNCTION public.compute_health_score(_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer := 0;
  v_payment integer := 0;
  v_usage integer := 0;
  v_onboarding integer := 0;
  v_modules integer := 0;
  v_support integer := 0;
  v_org record;
  v_overdue_count integer;
  v_active_modules integer;
  v_total_modules integer;
  v_urgent_tickets integer;
BEGIN
  SELECT id, last_active_at, onboarding_completed
    INTO v_org
  FROM public.organizations WHERE id = _org_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- (a) Payment health (30 pts) — sem faturas vencidas
  SELECT COUNT(*) INTO v_overdue_count
  FROM public.invoices
  WHERE organization_id = _org_id
    AND status IN ('open','overdue')
    AND due_at < CURRENT_DATE;
  v_payment := CASE
    WHEN v_overdue_count = 0 THEN 30
    WHEN v_overdue_count <= 2 THEN 15
    ELSE 0
  END;

  -- (b) Recent usage (25 pts) — last_active_at
  v_usage := CASE
    WHEN v_org.last_active_at IS NULL THEN 0
    WHEN v_org.last_active_at >= now() - INTERVAL '7 days' THEN 25
    WHEN v_org.last_active_at >= now() - INTERVAL '30 days' THEN 15
    WHEN v_org.last_active_at >= now() - INTERVAL '90 days' THEN 5
    ELSE 0
  END;

  -- (c) Onboarding (20 pts)
  v_onboarding := CASE WHEN COALESCE(v_org.onboarding_completed, false) THEN 20 ELSE 0 END;

  -- (d) Modules adoption (15 pts) — % de módulos ativos
  SELECT COUNT(*) FILTER (WHERE status = 'active'),
         GREATEST(COUNT(*), 1)
    INTO v_active_modules, v_total_modules
  FROM public.organization_modules
  WHERE organization_id = _org_id;
  v_modules := LEAST(15, ROUND(15.0 * v_active_modules / v_total_modules)::int);

  -- (e) Support (10 pts) — sem tickets urgentes abertos
  SELECT COUNT(*) INTO v_urgent_tickets
  FROM public.support_tickets
  WHERE organization_id = _org_id
    AND priority = 'urgent'
    AND status NOT IN ('resolved','closed');
  v_support := CASE
    WHEN v_urgent_tickets = 0 THEN 10
    WHEN v_urgent_tickets = 1 THEN 5
    ELSE 0
  END;

  v_score := v_payment + v_usage + v_onboarding + v_modules + v_support;
  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$;

REVOKE ALL ON FUNCTION public.compute_health_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_health_score(uuid) TO authenticated;

-- ---------- 4. recompute_all_health_scores() ----------
CREATE OR REPLACE FUNCTION public.recompute_all_health_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_count integer := 0;
BEGIN
  IF NOT public.is_backoffice() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  FOR v_org IN SELECT id FROM public.organizations LOOP
    UPDATE public.organizations
       SET health_score = public.compute_health_score(v_org.id)
     WHERE id = v_org.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_all_health_scores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_all_health_scores() TO authenticated;

-- ---------- 5. purge_old_audit_logs(days) ----------
CREATE OR REPLACE FUNCTION public.purge_old_audit_logs(_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT public.is_backoffice() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  WITH d AS (
    DELETE FROM public.audit_log
    WHERE created_at < now() - (_days || ' days')::interval
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_audit_logs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_audit_logs(integer) TO authenticated;

COMMENT ON FUNCTION public.compute_health_score(uuid) IS
  'Calcula health score (0-100): payment 30 + usage 25 + onboarding 20 + modules 15 + support 10';
