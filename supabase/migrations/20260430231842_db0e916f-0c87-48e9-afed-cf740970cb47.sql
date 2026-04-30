-- =====================================================================
-- Phase 3 (Performance) — Server-side aggregation RPCs
-- 
-- Reduces client-side computation and round-trips:
-- - get_cashflow_summary_by_period: totals + monthly + by-category in 1 call
-- - get_dashboard_kpis: contracts/liabilities/CRM atomic KPIs in 1 call
--
-- Both functions use SECURITY INVOKER so existing RLS policies on
-- cashflow_entries, contracts, liabilities, crm_opportunities and
-- crm_pipeline_stages apply transparently.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Cashflow summary by period
-- Returns:
--   {
--     totals: { entradas, saidas, saldo, count },
--     monthly: [{ month: 'YYYY-MM', entradas, saidas, saldo }],
--     by_category: [{ tipo, categoria, total, count }]
--   }
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cashflow_summary_by_period(
  _organization_id uuid,
  _from date,
  _to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_totals jsonb;
  v_monthly jsonb;
  v_by_category jsonb;
BEGIN
  -- Aggregate totals (uses valor_realizado when present, else valor_previsto).
  SELECT jsonb_build_object(
    'entradas', COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN COALESCE(valor_realizado, valor_previsto) ELSE 0 END), 0),
    'saidas',   COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN COALESCE(valor_realizado, valor_previsto) ELSE 0 END), 0),
    'count',    COUNT(*)
  )
  INTO v_totals
  FROM public.cashflow_entries
  WHERE (_organization_id IS NULL OR organization_id = _organization_id)
    AND data_prevista BETWEEN _from AND _to;

  v_totals := v_totals || jsonb_build_object(
    'saldo', (v_totals->>'entradas')::numeric - (v_totals->>'saidas')::numeric
  );

  -- Monthly bucket (one row per YYYY-MM in range, even if zero).
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS month
    FROM generate_series(date_trunc('month', _from), date_trunc('month', _to), interval '1 month') d
  ),
  agg AS (
    SELECT
      to_char(date_trunc('month', data_prevista), 'YYYY-MM') AS month,
      SUM(CASE WHEN tipo = 'entrada' THEN COALESCE(valor_realizado, valor_previsto) ELSE 0 END) AS entradas,
      SUM(CASE WHEN tipo = 'saida'   THEN COALESCE(valor_realizado, valor_previsto) ELSE 0 END) AS saidas
    FROM public.cashflow_entries
    WHERE (_organization_id IS NULL OR organization_id = _organization_id)
      AND data_prevista BETWEEN _from AND _to
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month',    m.month,
    'entradas', COALESCE(a.entradas, 0),
    'saidas',   COALESCE(a.saidas, 0),
    'saldo',    COALESCE(a.entradas, 0) - COALESCE(a.saidas, 0)
  ) ORDER BY m.month), '[]'::jsonb)
  INTO v_monthly
  FROM months m
  LEFT JOIN agg a USING (month);

  -- By category (top categories by absolute total).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tipo',      tipo,
    'categoria', COALESCE(categoria, 'Sem categoria'),
    'total',     total,
    'count',     cnt
  ) ORDER BY total DESC), '[]'::jsonb)
  INTO v_by_category
  FROM (
    SELECT
      tipo,
      categoria,
      SUM(COALESCE(valor_realizado, valor_previsto)) AS total,
      COUNT(*) AS cnt
    FROM public.cashflow_entries
    WHERE (_organization_id IS NULL OR organization_id = _organization_id)
      AND data_prevista BETWEEN _from AND _to
    GROUP BY tipo, categoria
  ) t;

  RETURN jsonb_build_object(
    'totals',      v_totals,
    'monthly',     v_monthly,
    'by_category', v_by_category
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cashflow_summary_by_period(uuid, date, date) TO authenticated;


-- ---------------------------------------------------------------------
-- 2) Dashboard KPIs
-- Returns:
--   {
--     contracts: { active_count, monthly_value },
--     liabilities: { total, judiciais, contingencias_provaveis, judicial_count },
--     crm: { weighted_value, open_count, stale_count }
--   }
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  _organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contracts jsonb;
  v_liabilities jsonb;
  v_crm jsonb;
BEGIN
  -- Contracts: active count + monthly normalized value.
  SELECT jsonb_build_object(
    'active_count',  COUNT(*) FILTER (WHERE status = 'Ativo'),
    'monthly_value', COALESCE(SUM(
      CASE
        WHEN status = 'Ativo' AND tipo_recorrencia = 'mensal'      THEN valor
        WHEN status = 'Ativo' AND tipo_recorrencia = 'bimestral'   THEN valor / 2.0
        WHEN status = 'Ativo' AND tipo_recorrencia = 'trimestral'  THEN valor / 3.0
        WHEN status = 'Ativo' AND tipo_recorrencia = 'semestral'   THEN valor / 6.0
        WHEN status = 'Ativo' AND tipo_recorrencia = 'anual'       THEN valor / 12.0
        WHEN status = 'Ativo'                                      THEN valor
        ELSE 0
      END
    ), 0)
  )
  INTO v_contracts
  FROM public.contracts
  WHERE (_organization_id IS NULL OR organization_id = _organization_id);

  -- Liabilities aggregates.
  SELECT jsonb_build_object(
    'total',                   COALESCE(SUM(valor_atualizado), 0),
    'judiciais',               COALESCE(SUM(valor_atualizado) FILTER (WHERE status = 'judicial'), 0),
    'contingencias_provaveis', COALESCE(SUM(valor_atualizado) FILTER (WHERE probabilidade = 'provavel'), 0),
    'judicial_count',          COUNT(*) FILTER (WHERE status = 'judicial')
  )
  INTO v_liabilities
  FROM public.liabilities
  WHERE (_organization_id IS NULL OR organization_id = _organization_id);

  -- CRM weighted value (estimated_value × stage probability), open opps count, stale count.
  SELECT jsonb_build_object(
    'weighted_value', COALESCE(SUM(
      CASE
        WHEN o.won_at IS NULL AND o.lost_at IS NULL
        THEN o.estimated_value * COALESCE(s.probability, 0) / 100.0
        ELSE 0
      END
    ), 0),
    'open_count',  COUNT(*) FILTER (WHERE o.won_at IS NULL AND o.lost_at IS NULL),
    'stale_count', COUNT(*) FILTER (
      WHERE o.won_at IS NULL
        AND o.lost_at IS NULL
        AND o.updated_at < (now() - interval '30 days')
    )
  )
  INTO v_crm
  FROM public.crm_opportunities o
  LEFT JOIN public.crm_pipeline_stages s ON s.id = o.stage_id
  WHERE (_organization_id IS NULL OR o.organization_id = _organization_id);

  RETURN jsonb_build_object(
    'contracts',   v_contracts,
    'liabilities', v_liabilities,
    'crm',         v_crm
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(uuid) TO authenticated;


-- ---------------------------------------------------------------------
-- Supporting indexes (idempotent) — speed up the aggregations above.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cashflow_org_dataprev
  ON public.cashflow_entries (organization_id, data_prevista);

CREATE INDEX IF NOT EXISTS idx_contracts_org_status
  ON public.contracts (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_liabilities_org_status
  ON public.liabilities (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_crm_opps_org_open
  ON public.crm_opportunities (organization_id)
  WHERE won_at IS NULL AND lost_at IS NULL;