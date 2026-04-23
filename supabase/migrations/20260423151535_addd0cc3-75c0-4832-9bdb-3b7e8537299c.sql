
-- =========================================================
-- 1) Tabela report_templates (catálogo global)
-- =========================================================
CREATE TABLE public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_schedule_cron TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'cron', -- cron | manual | event
  category TEXT NOT NULL DEFAULT 'financeiro',
  default_payload_schema JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates visíveis a autenticados"
ON public.report_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas masters editam templates"
ON public.report_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) Tabela org_chat_bindings (canais autorizados por org)
-- =========================================================
CREATE TABLE public.org_chat_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('telegram','slack')),
  chat_id TEXT NOT NULL,
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, chat_id)
);

CREATE INDEX idx_org_chat_bindings_org ON public.org_chat_bindings(organization_id);

ALTER TABLE public.org_chat_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da org visualizam canais"
ON public.org_chat_bindings FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "Owners/admins gerenciam canais"
ON public.org_chat_bindings FOR ALL TO authenticated
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']))
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']));

CREATE TRIGGER trg_org_chat_bindings_updated_at
BEFORE UPDATE ON public.org_chat_bindings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3) Tabela report_schedules (agendamentos por org)
-- =========================================================
CREATE TABLE public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_code TEXT NOT NULL REFERENCES public.report_templates(code) ON DELETE RESTRICT,
  cron TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  mask_values BOOLEAN NOT NULL DEFAULT false,
  severity_threshold JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, template_code)
);

CREATE INDEX idx_report_schedules_org ON public.report_schedules(organization_id);
CREATE INDEX idx_report_schedules_next_run ON public.report_schedules(next_run_at) WHERE enabled = true;

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visualizam agendamentos"
ON public.report_schedules FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "Owners/admins gerenciam agendamentos"
ON public.report_schedules FOR ALL TO authenticated
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']))
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']));

CREATE TRIGGER trg_report_schedules_updated_at
BEFORE UPDATE ON public.report_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4) Tabela report_recipients (destinatários por agendamento)
-- =========================================================
CREATE TABLE public.report_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.report_schedules(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT, -- diretoria | financeiro | gestor | socio | controller
  chat_binding_id UUID REFERENCES public.org_chat_bindings(id) ON DELETE CASCADE,
  mask_values_override BOOLEAN,
  escalation_level INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR role IS NOT NULL OR chat_binding_id IS NOT NULL)
);

CREATE INDEX idx_report_recipients_schedule ON public.report_recipients(schedule_id);

ALTER TABLE public.report_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visualizam destinatários"
ON public.report_recipients FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.report_schedules rs
    WHERE rs.id = schedule_id
    AND (is_org_member(auth.uid(), rs.organization_id) OR has_backoffice_org_access(rs.organization_id))
  )
);

CREATE POLICY "Owners/admins gerenciam destinatários"
ON public.report_recipients FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.report_schedules rs
    WHERE rs.id = schedule_id
    AND (has_org_role(auth.uid(), rs.organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.report_schedules rs
    WHERE rs.id = schedule_id
    AND (has_org_role(auth.uid(), rs.organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']))
  )
);

-- =========================================================
-- 5) Tabela report_runs (execuções de geração)
-- =========================================================
CREATE TABLE public.report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.report_schedules(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_code TEXT NOT NULL,
  trigger_source TEXT NOT NULL DEFAULT 'cron', -- cron | manual | event | escalation
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB,
  pdf_path TEXT,
  signed_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | generated | failed
  error TEXT,
  created_by UUID
);

CREATE INDEX idx_report_runs_org ON public.report_runs(organization_id);
CREATE INDEX idx_report_runs_template ON public.report_runs(template_code);
CREATE INDEX idx_report_runs_generated ON public.report_runs(generated_at DESC);

ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visualizam execuções"
ON public.report_runs FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "Service role insere execuções"
ON public.report_runs FOR INSERT TO authenticated
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']));

-- =========================================================
-- 6) Tabela report_deliveries (auditoria de entregas)
-- =========================================================
CREATE TABLE public.report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id UUID,
  recipient_role TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('telegram','slack','email')),
  chat_binding_id UUID REFERENCES public.org_chat_bindings(id) ON DELETE SET NULL,
  chat_id_masked TEXT, -- apenas últimos dígitos para auditoria
  external_message_id TEXT, -- message_id do Telegram/Slack para validar callbacks
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | read
  delivery_attempt INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  signed_link_token TEXT,
  link_opened_at TIMESTAMPTZ,
  feedback_score TEXT, -- useful | not_useful | comment
  feedback_comment TEXT,
  feedback_at TIMESTAMPTZ,
  escalated_from UUID REFERENCES public.report_deliveries(id) ON DELETE SET NULL,
  escalation_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_deliveries_run ON public.report_deliveries(run_id);
CREATE INDEX idx_report_deliveries_org ON public.report_deliveries(organization_id);
CREATE INDEX idx_report_deliveries_status ON public.report_deliveries(status);
CREATE INDEX idx_report_deliveries_external_msg ON public.report_deliveries(external_message_id) WHERE external_message_id IS NOT NULL;
CREATE INDEX idx_report_deliveries_token ON public.report_deliveries(signed_link_token) WHERE signed_link_token IS NOT NULL;

ALTER TABLE public.report_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visualizam entregas"
ON public.report_deliveries FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "Owners/admins atualizam entregas"
ON public.report_deliveries FOR UPDATE TO authenticated
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']))
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']));

CREATE TRIGGER trg_report_deliveries_updated_at
BEFORE UPDATE ON public.report_deliveries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 7) Tabela escalation_policies (políticas de escalonamento)
-- =========================================================
CREATE TABLE public.escalation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_code TEXT NOT NULL REFERENCES public.report_templates(code) ON DELETE CASCADE,
  levels JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{level:1,roles:["coordenador"],wait_minutes:30},...]
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, template_code)
);

ALTER TABLE public.escalation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visualizam escalonamento"
ON public.escalation_policies FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "Owners/admins gerenciam escalonamento"
ON public.escalation_policies FOR ALL TO authenticated
USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']))
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_role(ARRAY['master','backoffice_admin']));

CREATE TRIGGER trg_escalation_policies_updated_at
BEFORE UPDATE ON public.escalation_policies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 8) Bucket de armazenamento "reports" (privado)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Acesso aos PDFs: o path inicia com {organization_id}/...
CREATE POLICY "Membros leem PDFs de sua org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND (
    is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR has_backoffice_org_access(((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Owners/admins inserem PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND has_org_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner','admin'])
);

CREATE POLICY "Service role gerencia PDFs"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'reports')
WITH CHECK (bucket_id = 'reports');

-- =========================================================
-- 9) Registro do módulo "relatorios-out"
-- =========================================================
INSERT INTO public.system_modules (module_key, label, enabled)
VALUES ('relatorios-out', 'Distribuição de Relatórios', true)
ON CONFLICT (module_key) DO NOTHING;

-- Habilita para todas as orgs com dashboard ativo
INSERT INTO public.organization_modules (organization_id, module_key, enabled)
SELECT DISTINCT organization_id, 'relatorios-out', true
FROM public.organization_modules
WHERE module_key = 'dashboard' AND enabled = true
ON CONFLICT (organization_id, module_key) DO NOTHING;

-- =========================================================
-- 10) Seed dos 6 templates priorizados
-- =========================================================
INSERT INTO public.report_templates (code, name, description, default_schedule_cron, trigger_type, category) VALUES
  ('daily_cash_summary', 'Resumo Diário de Caixa', 'Saldo inicial, entradas D-1, contas pagas D-1, vencidas, a vencer 7d, alerta de caixa', NULL, 'manual', 'tesouraria'),
  ('weekly_executive', 'Resumo Executivo Semanal', 'Caixa consolidado, empresas sob pressão, top desvios orçado×real, contratos críticos', '0 7 * * 1', 'cron', 'executivo'),
  ('exception_alerts', 'Alertas de Exceção', 'Saldo abaixo do mínimo, despesas sem classificação, conciliação pendente, contratos vencendo', NULL, 'event', 'compliance'),
  ('monthly_closing', 'Fechamento Mensal', 'DRE gerencial, fluxo previsto 90d, aging list, posição bancária consolidada', '0 8 1 * *', 'cron', 'fechamento'),
  ('weekly_aging', 'Aging Semanal AP/AR', 'Aging list AP/AR com top 10 críticos por bucket', '0 16 * * 5', 'cron', 'financeiro'),
  ('daily_treasury', 'Posição de Tesouraria Diária', 'Posição bancária por conta + uso de cheque especial', '0 8 * * *', 'cron', 'tesouraria')
ON CONFLICT (code) DO NOTHING;
