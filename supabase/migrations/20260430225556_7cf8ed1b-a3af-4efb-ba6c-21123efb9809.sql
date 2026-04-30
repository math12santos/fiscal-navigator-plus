
-- Revoke from anon and grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.etl_retry_item(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.etl_retry_failed(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.etl_cancel_job(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.etl_claim_items(INT) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.etl_mark_item_success(UUID, TEXT, UUID, JSONB) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.etl_mark_item_failure(UUID, TEXT) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.etl_mark_item_skipped(UUID, TEXT) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.etl_finalize_job(UUID) FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.etl_retry_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.etl_retry_failed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.etl_cancel_job(UUID) TO authenticated;
-- claim/mark/finalize são chamadas só pelo worker via service_role; não dar a authenticated
GRANT EXECUTE ON FUNCTION public.etl_claim_items(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.etl_mark_item_success(UUID, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.etl_mark_item_failure(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.etl_mark_item_skipped(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.etl_finalize_job(UUID) TO service_role;

-- Recria view com security_invoker para respeitar RLS do chamador
DROP VIEW IF EXISTS public.etl_jobs_unified;
CREATE VIEW public.etl_jobs_unified
WITH (security_invoker = true)
AS
SELECT
  id, organization_id, pipeline_key, module, source, status,
  total_count, ok_count, failed_count, skipped_count,
  started_at, finished_at, created_at, created_by,
  'etl_jobs'::text AS origin
FROM public.etl_jobs
UNION ALL
SELECT
  di.id, di.organization_id,
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
