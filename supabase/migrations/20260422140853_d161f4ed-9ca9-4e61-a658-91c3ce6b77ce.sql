-- ============================================================================
-- ANTI-DUPLICITY FOUNDATION FOR cashflow_entries
-- ----------------------------------------------------------------------------
-- Adds source_ref + dedup_hash to make deduplication a database guarantee
-- (instead of UI suposition).  source_ref stores the canonical projection
-- key (eg "contrato:<id>:<yyyy-MM-dd>", "crm:<opp_id>", "hr:<item_id>",
-- "parcela:<inst_id>", "dp:<emp>:<sub>:<yyyy-MM>").  dedup_hash is computed
-- as md5(organization_id|source|source_ref) and indexed UNIQUE so that
-- repeated materialization (double clicks, race conditions) cannot generate
-- duplicates.
-- ============================================================================

ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS source_ref TEXT;

-- Generated column needs to be added in its own statement.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashflow_entries'
      AND column_name = 'dedup_hash'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.cashflow_entries
        ADD COLUMN dedup_hash TEXT GENERATED ALWAYS AS (
          CASE
            WHEN source_ref IS NOT NULL AND organization_id IS NOT NULL
            THEN md5(organization_id::text || '|' || coalesce(source, '') || '|' || source_ref)
            ELSE NULL
          END
        ) STORED
    $sql$;
  END IF;
END $$;

-- Backfill: extract opp:<id> and Item: <id> markers stored in notes today.
-- CRM Won projections.
UPDATE public.cashflow_entries
SET source_ref = 'crm:' || substring(notes from 'opp:([0-9a-fA-F-]{36})')
WHERE source_ref IS NULL
  AND source = 'crm_won'
  AND notes ~ 'opp:[0-9a-fA-F-]{36}';

-- HR planning items.
UPDATE public.cashflow_entries
SET source_ref = 'hr:' || substring(notes from 'Item: ([0-9a-fA-F-]{36})')
WHERE source_ref IS NULL
  AND source = 'hr_planning'
  AND notes ~ 'Item: [0-9a-fA-F-]{36}';

-- Contract installments materialised with installment id.
UPDATE public.cashflow_entries
SET source_ref = 'parcela:' || contract_installment_id::text
WHERE source_ref IS NULL
  AND source = 'contrato'
  AND contract_installment_id IS NOT NULL;

-- Recurring contract entries (when contract_id + data_prevista exist).
UPDATE public.cashflow_entries
SET source_ref = 'contrato:' || contract_id::text || ':' || to_char(data_prevista, 'YYYY-MM-DD')
WHERE source_ref IS NULL
  AND source = 'contrato'
  AND contract_id IS NOT NULL
  AND contract_installment_id IS NULL;

-- Deduplicate any existing collisions BEFORE creating the unique index.
-- Keep the oldest row (smallest created_at), null-out source_ref on the rest
-- so they don't break the unique constraint.  We don't delete because they
-- may carry user-edited data; they'll show up in the runtime collision
-- detector instead.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id, source, source_ref
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.cashflow_entries
  WHERE source_ref IS NOT NULL
)
UPDATE public.cashflow_entries c
SET source_ref = NULL
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

-- Unique partial index: only enforced when source_ref is set.
CREATE UNIQUE INDEX IF NOT EXISTS cashflow_entries_dedup_uq
  ON public.cashflow_entries (dedup_hash)
  WHERE dedup_hash IS NOT NULL;

-- Helpful lookup index for runtime queries / detector.
CREATE INDEX IF NOT EXISTS cashflow_entries_source_ref_idx
  ON public.cashflow_entries (organization_id, source, source_ref)
  WHERE source_ref IS NOT NULL;