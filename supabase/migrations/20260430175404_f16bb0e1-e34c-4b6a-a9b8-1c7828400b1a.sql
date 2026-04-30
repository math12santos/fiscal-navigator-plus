-- ============================================================
-- 1) integration_endpoints: endpoints de webhook
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integration_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,                 -- 'omie' | 'conta_azul' | 'bling' | 'custom' | etc
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,              -- hash sha256 do token compartilhado
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb, -- mapping de campos do payload → cashflow
  default_account_id UUID,
  default_cost_center_id UUID,
  default_bank_account_id UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  last_received_at TIMESTAMPTZ,
  events_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_endpoints_org
  ON public.integration_endpoints (organization_id, active);

ALTER TABLE public.integration_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "endpoints_select_member"
  ON public.integration_endpoints FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "endpoints_insert_admin"
  ON public.integration_endpoints FOR INSERT
  WITH CHECK (
    (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id))
    AND auth.uid() = user_id
  );

CREATE POLICY "endpoints_update_admin"
  ON public.integration_endpoints FOR UPDATE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE POLICY "endpoints_delete_admin"
  ON public.integration_endpoints FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_integration_endpoints_updated_at
  BEFORE UPDATE ON public.integration_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) integration_events: log de eventos recebidos (idempotência)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  endpoint_id UUID NOT NULL REFERENCES public.integration_endpoints(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,             -- id do evento no sistema de origem (idempotência)
  event_type TEXT,                       -- 'cashflow.create' | 'cashflow.update' | 'invoice.paid' | etc
  raw_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received', -- 'received' | 'processed' | 'error' | 'ignored'
  error_message TEXT,
  cashflow_entry_id UUID,                -- referência criada (se aplicável)
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (endpoint_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_events_org_status
  ON public.integration_events (organization_id, status, received_at DESC);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_member"
  ON public.integration_events FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- INSERT/UPDATE feitos pela edge function via service_role (bypass RLS)

-- ============================================================
-- 3) import_templates: templates de mapeamento de colunas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,         -- 'cashflow' | 'bank_statement' | 'contracts' | etc
  provider TEXT,                     -- 'omie' | 'itau' | 'bradesco' | 'custom'
  column_mapping JSONB NOT NULL,     -- { csv_col: target_field }
  default_values JSONB DEFAULT '{}'::jsonb,
  delimiter TEXT DEFAULT ',',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  decimal_separator TEXT DEFAULT '.',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_templates_org
  ON public.import_templates (organization_id, source_type, active);

ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_member"
  ON public.import_templates FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "templates_insert_member"
  ON public.import_templates FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = user_id);

CREATE POLICY "templates_update_member"
  ON public.import_templates FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "templates_delete_member"
  ON public.import_templates FOR DELETE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_import_templates_updated_at
  BEFORE UPDATE ON public.import_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) Função: rotacionar/gerar secret do endpoint
-- ============================================================
CREATE OR REPLACE FUNCTION public.rotate_endpoint_secret(p_endpoint_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID;
  v_token TEXT;
  v_hash TEXT;
BEGIN
  SELECT organization_id INTO v_org FROM public.integration_endpoints WHERE id = p_endpoint_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Endpoint não encontrado';
  END IF;
  IF NOT (has_org_role(auth.uid(), v_org, ARRAY['owner','admin']) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  -- Token aleatório (64 hex chars). Hash sha256 fica no banco.
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  UPDATE public.integration_endpoints
    SET secret_hash = v_hash, updated_at = now()
    WHERE id = p_endpoint_id;

  RETURN v_token; -- mostrar UMA vez na UI
END;
$$;

-- Garante extensão pgcrypto para digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;