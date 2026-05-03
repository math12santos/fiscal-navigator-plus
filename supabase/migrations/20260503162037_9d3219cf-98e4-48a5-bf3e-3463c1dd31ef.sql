
CREATE TABLE IF NOT EXISTS public.org_data_version (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_data_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read org data version"
  ON public.org_data_version FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE TABLE IF NOT EXISTS public.dashboard_snapshots (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  payload jsonb NOT NULL,
  data_version bigint NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  stale_at timestamptz NOT NULL DEFAULT now() + interval '3 hours',
  PRIMARY KEY (organization_id, reference_month)
);

ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read dashboard snapshots"
  ON public.dashboard_snapshots FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE OR REPLACE FUNCTION public.bump_org_data_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  v_org := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  IF v_org IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.org_data_version (organization_id, version, updated_at)
  VALUES (v_org, 1, now())
  ON CONFLICT (organization_id)
  DO UPDATE SET version = public.org_data_version.version + 1, updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cashflow_entries',
    'contracts',
    'contract_installments',
    'liabilities',
    'crm_opportunities',
    'payroll_items',
    'payroll_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_bump_org_version ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_bump_org_version
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.bump_org_data_version();',
      t
    );
  END LOOP;
END$$;

CREATE OR REPLACE FUNCTION public.recompute_dashboard_snapshot(
  _organization_id uuid,
  _reference_month date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_first date := date_trunc('month', _reference_month)::date;
  v_range_from date := (v_ref_first - interval '5 months')::date;
  v_range_to date := (v_ref_first + interval '1 month' - interval '1 day')::date;
  v_prev_first date := (v_ref_first - interval '1 month')::date;
  v_prev_last date := (v_ref_first - interval '1 day')::date;

  v_kpis jsonb;
  v_cashflow_summary jsonb;
  v_current_month jsonb;
  v_previous_month jsonb;
  v_expense_by_category jsonb;
  v_avg_payroll numeric := 0;
  v_version bigint;
  v_payload jsonb;
BEGIN
  IF _organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  v_kpis := public.get_dashboard_kpis(_organization_id);
  v_cashflow_summary := public.get_cashflow_summary_by_period(_organization_id, v_range_from, v_range_to);

  SELECT jsonb_build_object(
    'entradas', COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN COALESCE(valor_realizado, valor_previsto) END), 0),
    'saidas',   COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN COALESCE(valor_realizado, valor_previsto) END), 0)
  ) INTO v_current_month
  FROM public.cashflow_entries
  WHERE organization_id = _organization_id
    AND data_prevista BETWEEN v_ref_first AND v_range_to;

  SELECT jsonb_build_object(
    'entradas', COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN COALESCE(valor_realizado, valor_previsto) END), 0),
    'saidas',   COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN COALESCE(valor_realizado, valor_previsto) END), 0)
  ) INTO v_previous_month
  FROM public.cashflow_entries
  WHERE organization_id = _organization_id
    AND data_prevista BETWEEN v_prev_first AND v_prev_last;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', categoria, 'value', total) ORDER BY total DESC), '[]'::jsonb)
  INTO v_expense_by_category
  FROM (
    SELECT COALESCE(categoria, 'Outros') AS categoria,
           SUM(COALESCE(valor_realizado, valor_previsto)) AS total
    FROM public.cashflow_entries
    WHERE organization_id = _organization_id
      AND tipo = 'saida'
      AND data_prevista BETWEEN v_ref_first AND v_range_to
    GROUP BY 1
  ) sub;

  SELECT COALESCE(AVG(total), 0) INTO v_avg_payroll
  FROM (
    SELECT pr.reference_month,
           SUM(COALESCE(pi.total_bruto, 0) + COALESCE(pi.total_encargos, 0)) AS total
    FROM public.payroll_runs pr
    LEFT JOIN public.payroll_items pi ON pi.payroll_run_id = pr.id
    WHERE pr.organization_id = _organization_id
      AND pr.reference_month BETWEEN v_range_from AND v_range_to
    GROUP BY pr.reference_month
  ) p;

  SELECT version INTO v_version FROM public.org_data_version WHERE organization_id = _organization_id;
  IF v_version IS NULL THEN
    INSERT INTO public.org_data_version (organization_id, version)
    VALUES (_organization_id, 1)
    ON CONFLICT DO NOTHING;
    v_version := 1;
  END IF;

  v_payload := jsonb_build_object(
    'kpis', v_kpis,
    'cashflow_summary', v_cashflow_summary,
    'current_month', v_current_month,
    'previous_month', v_previous_month,
    'expense_by_category', v_expense_by_category,
    'avg_monthly_payroll', v_avg_payroll,
    'range', jsonb_build_object('from', v_range_from, 'to', v_range_to),
    'reference_month', v_ref_first
  );

  INSERT INTO public.dashboard_snapshots (
    organization_id, reference_month, payload, data_version, computed_at, stale_at
  ) VALUES (
    _organization_id, v_ref_first, v_payload, v_version, now(), now() + interval '3 hours'
  )
  ON CONFLICT (organization_id, reference_month)
  DO UPDATE SET
    payload = EXCLUDED.payload,
    data_version = EXCLUDED.data_version,
    computed_at = EXCLUDED.computed_at,
    stale_at = EXCLUDED.stale_at;

  RETURN jsonb_build_object(
    'payload', v_payload,
    'computed_at', now(),
    'data_version', v_version,
    'cache_hit', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_snapshot(
  _organization_id uuid,
  _reference_month date,
  _force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_first date := date_trunc('month', _reference_month)::date;
  v_snap public.dashboard_snapshots%ROWTYPE;
  v_current_version bigint;
BEGIN
  IF _organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF NOT (is_org_member(auth.uid(), _organization_id)
          OR has_backoffice_org_access(_organization_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT * INTO v_snap
  FROM public.dashboard_snapshots
  WHERE organization_id = _organization_id AND reference_month = v_ref_first;

  SELECT COALESCE(version, 0) INTO v_current_version
  FROM public.org_data_version
  WHERE organization_id = _organization_id;
  v_current_version := COALESCE(v_current_version, 0);

  IF NOT _force
     AND v_snap.organization_id IS NOT NULL
     AND v_snap.stale_at > now()
     AND v_snap.data_version >= v_current_version THEN
    RETURN jsonb_build_object(
      'payload', v_snap.payload,
      'computed_at', v_snap.computed_at,
      'data_version', v_snap.data_version,
      'cache_hit', true
    );
  END IF;

  RETURN public.recompute_dashboard_snapshot(_organization_id, v_ref_first);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_orgs_for_snapshot_warmup()
RETURNS TABLE(organization_id uuid, reference_month date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT odv.organization_id, date_trunc('month', now())::date
  FROM public.org_data_version odv
  WHERE odv.updated_at > now() - interval '30 days';
$$;

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_stale ON public.dashboard_snapshots (stale_at);
CREATE INDEX IF NOT EXISTS idx_org_data_version_updated ON public.org_data_version (updated_at);
