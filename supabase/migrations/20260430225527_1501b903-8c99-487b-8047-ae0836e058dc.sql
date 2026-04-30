
-- ============================================================
-- ETL/ELT Core: jobs, job_items, pipelines catalog
-- ============================================================

-- Catálogo de pipelines
CREATE TABLE public.etl_pipelines (
  key TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  worker TEXT NOT NULL DEFAULT 'edge' CHECK (worker IN ('edge','rpc')),
  target_handler TEXT,
  cron_expr TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  max_attempts INT NOT NULL DEFAULT 4,
  batch_size INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_etl_pipelines_updated_at
  BEFORE UPDATE ON public.etl_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.etl_pipelines ENABLE ROW LEVEL SECURITY;

-- Catálogo é global, leitura para qualquer autenticado; escrita só master/backoffice_admin
CREATE POLICY "etl_pipelines_select_authenticated"
  ON public.etl_pipelines FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "etl_pipelines_write_master"
  ON public.etl_pipelines FOR ALL
  TO authenticated
  USING (has_backoffice_role(ARRAY['master','backoffice_admin']))
  WITH CHECK (has_backoffice_role(ARRAY['master','backoffice_admin']));

-- Jobs (1 linha por execução)
CREATE TABLE public.etl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_key TEXT NOT NULL REFERENCES public.etl_pipelines(key),
  module TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('upload','webhook','api','cron','manual')),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','partial','cancelled')),
  total_count INT NOT NULL DEFAULT 0,
  ok_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, pipeline_key, idempotency_key)
);

CREATE INDEX idx_etl_jobs_org_status ON public.etl_jobs (organization_id, status, created_at DESC);
CREATE INDEX idx_etl_jobs_pipeline ON public.etl_jobs (pipeline_key, status);
CREATE INDEX idx_etl_jobs_queued ON public.etl_jobs (status, created_at) WHERE status = 'queued';

CREATE TRIGGER trg_etl_jobs_updated_at
  BEFORE UPDATE ON public.etl_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.etl_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etl_jobs_select_member"
  ON public.etl_jobs FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "etl_jobs_insert_member"
  ON public.etl_jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "etl_jobs_update_admin"
  ON public.etl_jobs FOR UPDATE
  TO authenticated
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

-- Items por job (substitui generalizado data_import_rows; este novo coexiste)
CREATE TABLE public.etl_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.etl_jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  external_ref TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','skipped','dead')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 4,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapped JSONB,
  target_table TEXT,
  target_id UUID,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, idempotency_key)
);

CREATE INDEX idx_etl_items_job ON public.etl_job_items (job_id, status);
CREATE INDEX idx_etl_items_pending ON public.etl_job_items (status, next_attempt_at) WHERE status IN ('queued','failed');
CREATE INDEX idx_etl_items_org_dead ON public.etl_job_items (organization_id, status) WHERE status = 'dead';

ALTER TABLE public.etl_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etl_items_select_member"
  ON public.etl_job_items FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "etl_items_insert_member"
  ON public.etl_job_items FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "etl_items_update_admin"
  ON public.etl_job_items FOR UPDATE
  TO authenticated
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

-- ============================================================
-- RPCs de orquestração
-- ============================================================

-- Reprocessar 1 item: reseta estado preservando idempotency_key
CREATE OR REPLACE FUNCTION public.etl_retry_item(p_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.etl_job_items WHERE id = p_item_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  IF NOT (has_org_role(auth.uid(), v_org, ARRAY['owner','admin']) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  UPDATE public.etl_job_items
    SET status = 'queued',
        attempts = 0,
        next_attempt_at = now(),
        last_error = NULL
    WHERE id = p_item_id;
END;
$$;

-- Reprocessar todos os items failed/dead de um job
CREATE OR REPLACE FUNCTION public.etl_retry_failed(p_job_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID;
  v_count INT;
BEGIN
  SELECT organization_id INTO v_org FROM public.etl_jobs WHERE id = p_job_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Job não encontrado';
  END IF;
  IF NOT (has_org_role(auth.uid(), v_org, ARRAY['owner','admin']) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  UPDATE public.etl_job_items
    SET status = 'queued',
        attempts = 0,
        next_attempt_at = now(),
        last_error = NULL
    WHERE job_id = p_job_id AND status IN ('failed','dead');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Reabrir o job
  UPDATE public.etl_jobs
    SET status = 'queued', error_message = NULL, finished_at = NULL
    WHERE id = p_job_id;

  RETURN v_count;
END;
$$;

-- Cancelar job
CREATE OR REPLACE FUNCTION public.etl_cancel_job(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.etl_jobs WHERE id = p_job_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Job não encontrado';
  END IF;
  IF NOT (has_org_role(auth.uid(), v_org, ARRAY['owner','admin']) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  UPDATE public.etl_jobs
    SET status = 'cancelled', finished_at = now()
    WHERE id = p_job_id AND status IN ('queued','running','partial');

  UPDATE public.etl_job_items
    SET status = 'skipped',
        last_error = 'Job cancelado'
    WHERE job_id = p_job_id AND status IN ('queued','failed');
END;
$$;

-- Atomic claim: pega N items prontos para processar (worker chama isto)
CREATE OR REPLACE FUNCTION public.etl_claim_items(p_limit INT DEFAULT 50)
RETURNS SETOF public.etl_job_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Apenas service_role (edge function) deve chamar isto
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.etl_job_items
    WHERE status IN ('queued','failed')
      AND next_attempt_at <= now()
      AND attempts < max_attempts
    ORDER BY next_attempt_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.etl_job_items i
    SET status = 'running',
        attempts = i.attempts + 1
    FROM picked
    WHERE i.id = picked.id
    RETURNING i.*;
END;
$$;

-- Marca item como sucesso
CREATE OR REPLACE FUNCTION public.etl_mark_item_success(
  p_item_id UUID,
  p_target_table TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_mapped JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.etl_job_items
    SET status = 'succeeded',
        target_table = COALESCE(p_target_table, target_table),
        target_id = COALESCE(p_target_id, target_id),
        mapped = COALESCE(p_mapped, mapped),
        last_error = NULL,
        processed_at = now()
    WHERE id = p_item_id;
END;
$$;

-- Marca item como falha (com backoff exponencial)
CREATE OR REPLACE FUNCTION public.etl_mark_item_failure(
  p_item_id UUID,
  p_error TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempts INT;
  v_max INT;
  v_status TEXT;
  v_delay_min INT;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
    FROM public.etl_job_items WHERE id = p_item_id;

  -- Backoff: 1, 5, 30, 120 minutos
  v_delay_min := CASE v_attempts
    WHEN 1 THEN 1
    WHEN 2 THEN 5
    WHEN 3 THEN 30
    ELSE 120
  END;

  v_status := CASE WHEN v_attempts >= v_max THEN 'dead' ELSE 'failed' END;

  UPDATE public.etl_job_items
    SET status = v_status,
        last_error = p_error,
        next_attempt_at = now() + (v_delay_min || ' minutes')::interval,
        processed_at = now()
    WHERE id = p_item_id;
END;
$$;

-- Marca item como skipped (idempotência)
CREATE OR REPLACE FUNCTION public.etl_mark_item_skipped(
  p_item_id UUID,
  p_reason TEXT DEFAULT 'duplicate'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.etl_job_items
    SET status = 'skipped',
        last_error = p_reason,
        processed_at = now()
    WHERE id = p_item_id;
END;
$$;

-- Fecha job: calcula totais e seta status final
CREATE OR REPLACE FUNCTION public.etl_finalize_job(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total INT; v_ok INT; v_failed INT; v_skipped INT; v_pending INT;
  v_status TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COUNT(*) FILTER (WHERE status IN ('failed','dead')),
    COUNT(*) FILTER (WHERE status = 'skipped'),
    COUNT(*) FILTER (WHERE status IN ('queued','running'))
  INTO v_total, v_ok, v_failed, v_skipped, v_pending
  FROM public.etl_job_items WHERE job_id = p_job_id;

  IF v_pending > 0 THEN
    v_status := 'running';
  ELSIF v_total = 0 THEN
    v_status := 'succeeded';
  ELSIF v_failed = 0 THEN
    v_status := 'succeeded';
  ELSIF v_ok > 0 OR v_skipped > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'failed';
  END IF;

  UPDATE public.etl_jobs
    SET total_count = v_total,
        ok_count = v_ok,
        failed_count = v_failed,
        skipped_count = v_skipped,
        status = v_status,
        started_at = COALESCE(started_at, now()),
        finished_at = CASE WHEN v_pending = 0 THEN now() ELSE NULL END
    WHERE id = p_job_id;
END;
$$;

-- View unificada: imports legados + novos jobs (read-only)
CREATE OR REPLACE VIEW public.etl_jobs_unified AS
SELECT
  id,
  organization_id,
  pipeline_key,
  module,
  source,
  status,
  total_count,
  ok_count,
  failed_count,
  skipped_count,
  started_at,
  finished_at,
  created_at,
  created_by,
  'etl_jobs'::text AS origin
FROM public.etl_jobs
UNION ALL
SELECT
  di.id,
  di.organization_id,
  ('legacy.' || di.source_type)::text AS pipeline_key,
  'legacy'::text AS module,
  'upload'::text AS source,
  di.status,
  COALESCE(di.row_count, 0) AS total_count,
  COALESCE((SELECT COUNT(*) FROM public.data_import_rows r WHERE r.import_id = di.id AND r.status IN ('completed','imported','ok')), 0)::int AS ok_count,
  COALESCE((SELECT COUNT(*) FROM public.data_import_rows r WHERE r.import_id = di.id AND r.status IN ('failed','error')), 0)::int AS failed_count,
  0 AS skipped_count,
  di.created_at AS started_at,
  di.imported_at AS finished_at,
  di.created_at,
  di.user_id AS created_by,
  'data_imports'::text AS origin
FROM public.data_imports di;

-- Seed inicial: 1 pipeline de teste
INSERT INTO public.etl_pipelines (key, module, label, description, worker, target_handler, max_attempts, batch_size)
VALUES
  ('_core.echo', '_core', 'Echo (teste)', 'Pipeline de teste que apenas registra os items como sucesso', 'edge', 'echo', 2, 50)
ON CONFLICT (key) DO NOTHING;
