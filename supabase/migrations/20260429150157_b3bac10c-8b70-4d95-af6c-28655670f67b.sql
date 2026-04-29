-- =========================================================================
-- Migration: cashflow_entries — chave única canônica (org, source, source_ref)
-- =========================================================================
-- Objetivo:
--   Substituir a chave de idempotência baseada em `dedup_hash` (que nunca foi
--   preenchida) por uma chave determinística e MECE-aderente:
--     UNIQUE (organization_id, source, source_ref)  WHERE source_ref IS NOT NULL
--   Aplicada apenas a lançamentos materializados a partir de outros módulos
--   (CRM, RH, Rescisões, Contratos). Lançamentos manuais permanecem livres.
--
-- Procedimento:
--   1. Auditoria de duplicidade (RAISE NOTICE com totais e exemplos).
--   2. Dedupe defensivo preservando a linha mais antiga (princípio
--      "passado é imutável" — marcamos as demais como 'cancelado' com nota).
--   3. Criação do índice único parcial.
--   4. Comentário no índice antigo (depreciação branda).
-- =========================================================================

DO $$
DECLARE
  v_total           BIGINT;
  v_null_ref        BIGINT;
  v_dup_groups      BIGINT;
  v_dup_rows        BIGINT;
  v_old_dup_hash    BIGINT;
  v_resolved        BIGINT := 0;
  r                 RECORD;
  i                 INT := 0;
BEGIN
  -- ---------- 1) AUDITORIA ------------------------------------------------
  SELECT COUNT(*) INTO v_total FROM public.cashflow_entries;
  SELECT COUNT(*) INTO v_null_ref
    FROM public.cashflow_entries WHERE source_ref IS NULL;

  WITH grp AS (
    SELECT organization_id, source, source_ref, COUNT(*) AS c
    FROM public.cashflow_entries
    WHERE source_ref IS NOT NULL
    GROUP BY organization_id, source, source_ref
    HAVING COUNT(*) > 1
  )
  SELECT COUNT(*), COALESCE(SUM(c - 1), 0)
    INTO v_dup_groups, v_dup_rows FROM grp;

  WITH grp_old AS (
    SELECT dedup_hash, COUNT(*) AS c
    FROM public.cashflow_entries
    WHERE dedup_hash IS NOT NULL
    GROUP BY dedup_hash
    HAVING COUNT(*) > 1
  )
  SELECT COALESCE(SUM(c - 1), 0) INTO v_old_dup_hash FROM grp_old;

  RAISE NOTICE
    '[cashflow_dedup_audit] total=% | source_ref_null=% | dup_groups=% | dup_rows_to_resolve=% | legacy_dedup_hash_dups=%',
    v_total, v_null_ref, v_dup_groups, v_dup_rows, v_old_dup_hash;

  -- Exemplos (até 5) das duplicatas detectadas
  IF v_dup_rows > 0 THEN
    FOR r IN
      SELECT organization_id, source, source_ref, COUNT(*) AS c,
             MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
      FROM public.cashflow_entries
      WHERE source_ref IS NOT NULL
      GROUP BY organization_id, source, source_ref
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 5
    LOOP
      i := i + 1;
      RAISE NOTICE '  exemplo %: org=% source=% ref=% count=% (first=% last=%)',
        i, r.organization_id, r.source, r.source_ref, r.c, r.first_seen, r.last_seen;
    END LOOP;
  END IF;

  -- ---------- 2) DEDUPE DEFENSIVO ----------------------------------------
  -- Mantém a linha mais antiga (created_at MIN, desempate por id).
  -- As demais ficam como 'cancelado' com nota explicativa para auditoria.
  IF v_dup_rows > 0 THEN
    WITH ranked AS (
      SELECT id, organization_id, source, source_ref, created_at,
             ROW_NUMBER() OVER (
               PARTITION BY organization_id, source, source_ref
               ORDER BY created_at ASC, id ASC
             ) AS rn
      FROM public.cashflow_entries
      WHERE source_ref IS NOT NULL
    ),
    to_cancel AS (
      SELECT id FROM ranked WHERE rn > 1
    )
    UPDATE public.cashflow_entries c
       SET status = 'cancelado',
           notes  = COALESCE(c.notes, '') ||
                    CASE WHEN c.notes IS NULL OR c.notes = '' THEN '' ELSE E'\n' END ||
                    '[dedup ' || to_char(now(), 'YYYY-MM-DD') ||
                    '] Cancelado por duplicidade — mantida entrada mais antiga com mesmo (organization_id, source, source_ref).'
     WHERE c.id IN (SELECT id FROM to_cancel)
       AND c.status IS DISTINCT FROM 'cancelado';

    GET DIAGNOSTICS v_resolved = ROW_COUNT;
    RAISE NOTICE '[cashflow_dedup_audit] linhas marcadas como cancelado: %', v_resolved;
  END IF;
END
$$;

-- ---------- 3) ÍNDICE ÚNICO CANÔNICO ----------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS cashflow_entries_org_source_ref_uq
  ON public.cashflow_entries (organization_id, source, source_ref)
  WHERE source_ref IS NOT NULL;

COMMENT ON INDEX public.cashflow_entries_org_source_ref_uq IS
  'Chave de idempotência canônica para materializações vindas de outros módulos (CRM, RH, Rescisões, Contratos). Use ON CONFLICT (organization_id, source, source_ref).';

-- ---------- 4) DEPRECIAÇÃO BRANDA DO ÍNDICE ANTIGO --------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'cashflow_entries_dedup_uq'
  ) THEN
    EXECUTE 'COMMENT ON INDEX public.cashflow_entries_dedup_uq IS ' ||
            quote_literal('DEPRECATED — substituído por cashflow_entries_org_source_ref_uq. ' ||
                          'Mantido temporariamente para compatibilidade. dedup_hash não é mais ' ||
                          'usado pelo aplicativo a partir desta migração.');
  END IF;
END $$;