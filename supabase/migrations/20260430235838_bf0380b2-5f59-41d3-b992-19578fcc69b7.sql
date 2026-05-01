-- =========================================================
-- FASE 2 — Dashboard executivo SaaS
-- RPC: get_saas_kpis()
-- Acesso: somente BackOffice (is_backoffice)
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_saas_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_mrr numeric := 0;
  v_arr numeric := 0;
  v_arpu numeric := 0;
  v_active_count int := 0;
  v_trial_count int := 0;
  v_past_due_count int := 0;
  v_canceled_count int := 0;
  v_total_orgs int := 0;
  v_revenue_12m numeric := 0;
  v_open_amount numeric := 0;
  v_overdue_amount numeric := 0;
  v_growth jsonb;
  v_revenue_series jsonb;
  v_top_revenue jsonb;
  v_top_overdue jsonb;
  v_plan_breakdown jsonb;
BEGIN
  -- Authorization: backoffice only
  IF NOT public.is_backoffice() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- ============ Counters ============
  SELECT COUNT(*) INTO v_total_orgs FROM public.organizations;

  SELECT
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'trialing'),
    COUNT(*) FILTER (WHERE status = 'past_due'),
    COUNT(*) FILTER (WHERE status = 'canceled')
  INTO v_active_count, v_trial_count, v_past_due_count, v_canceled_count
  FROM public.subscriptions;

  -- ============ MRR (active + past_due, normalized to monthly) ============
  SELECT COALESCE(SUM(
    CASE
      WHEN s.billing_cycle = 'yearly' THEN
        COALESCE(s.custom_price, p.price_yearly) / 12.0
      ELSE
        COALESCE(s.custom_price, p.price_monthly)
    END
    * (1 - COALESCE(s.discount_pct, 0) / 100.0)
    * GREATEST(s.seats, 1)
  ), 0)
  INTO v_mrr
  FROM public.subscriptions s
  JOIN public.billing_plans p ON p.id = s.plan_id
  WHERE s.status IN ('active', 'past_due');

  v_arr := v_mrr * 12;
  v_arpu := CASE WHEN v_active_count > 0 THEN v_mrr / v_active_count ELSE 0 END;

  -- ============ Revenue last 12 months (paid invoices) ============
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue_12m
  FROM public.invoices
  WHERE status = 'paid' AND paid_at >= now() - INTERVAL '12 months';

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status = 'open'), 0),
    COALESCE(SUM(amount) FILTER (WHERE status = 'overdue' OR (status = 'open' AND due_at < CURRENT_DATE)), 0)
  INTO v_open_amount, v_overdue_amount
  FROM public.invoices;

  -- ============ Growth series 12m: new vs canceled ============
  WITH months AS (
    SELECT date_trunc('month', generate_series(
      date_trunc('month', now() - INTERVAL '11 months'),
      date_trunc('month', now()),
      INTERVAL '1 month'
    ))::date AS m
  ),
  news AS (
    SELECT date_trunc('month', created_at)::date AS m, COUNT(*) AS qty
    FROM public.subscriptions
    WHERE created_at >= now() - INTERVAL '12 months'
    GROUP BY 1
  ),
  cancels AS (
    SELECT date_trunc('month', canceled_at)::date AS m, COUNT(*) AS qty
    FROM public.subscriptions
    WHERE canceled_at IS NOT NULL AND canceled_at >= now() - INTERVAL '12 months'
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'month', to_char(months.m, 'YYYY-MM'),
    'new', COALESCE(news.qty, 0),
    'canceled', COALESCE(cancels.qty, 0),
    'net', COALESCE(news.qty, 0) - COALESCE(cancels.qty, 0)
  ) ORDER BY months.m)
  INTO v_growth
  FROM months
  LEFT JOIN news ON news.m = months.m
  LEFT JOIN cancels ON cancels.m = months.m;

  -- ============ Revenue series 12m: invoiced vs paid ============
  WITH months AS (
    SELECT date_trunc('month', generate_series(
      date_trunc('month', now() - INTERVAL '11 months'),
      date_trunc('month', now()),
      INTERVAL '1 month'
    ))::date AS m
  ),
  inv AS (
    SELECT date_trunc('month', issued_at)::date AS m,
           SUM(amount) FILTER (WHERE status <> 'void') AS invoiced,
           SUM(amount) FILTER (WHERE status = 'paid') AS paid
    FROM public.invoices
    WHERE issued_at >= now() - INTERVAL '12 months'
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'month', to_char(months.m, 'YYYY-MM'),
    'invoiced', COALESCE(inv.invoiced, 0),
    'paid', COALESCE(inv.paid, 0)
  ) ORDER BY months.m)
  INTO v_revenue_series
  FROM months
  LEFT JOIN inv ON inv.m = months.m;

  -- ============ Top 5 customers by revenue (12m) ============
  SELECT jsonb_agg(t)
  INTO v_top_revenue
  FROM (
    SELECT o.id, o.name, COALESCE(SUM(i.amount), 0) AS revenue
    FROM public.organizations o
    JOIN public.invoices i ON i.organization_id = o.id
    WHERE i.status = 'paid' AND i.paid_at >= now() - INTERVAL '12 months'
    GROUP BY o.id, o.name
    ORDER BY revenue DESC
    LIMIT 5
  ) t;

  -- ============ Top overdue customers ============
  SELECT jsonb_agg(t)
  INTO v_top_overdue
  FROM (
    SELECT o.id, o.name,
           COUNT(i.*) AS open_invoices,
           COALESCE(SUM(i.amount), 0) AS overdue_amount,
           MIN(i.due_at) AS oldest_due
    FROM public.organizations o
    JOIN public.invoices i ON i.organization_id = o.id
    WHERE i.status IN ('open', 'overdue') AND i.due_at < CURRENT_DATE
    GROUP BY o.id, o.name
    ORDER BY overdue_amount DESC
    LIMIT 5
  ) t;

  -- ============ Plan breakdown (active subs) ============
  SELECT jsonb_agg(t)
  INTO v_plan_breakdown
  FROM (
    SELECT p.code, p.name, COUNT(s.*) AS subscribers,
           COALESCE(SUM(
             CASE WHEN s.billing_cycle = 'yearly'
                  THEN COALESCE(s.custom_price, p.price_yearly) / 12.0
                  ELSE COALESCE(s.custom_price, p.price_monthly)
             END * (1 - COALESCE(s.discount_pct, 0)/100.0) * GREATEST(s.seats, 1)
           ), 0) AS mrr
    FROM public.billing_plans p
    LEFT JOIN public.subscriptions s
      ON s.plan_id = p.id AND s.status IN ('active', 'past_due')
    WHERE p.is_active
    GROUP BY p.code, p.name, p.sort_order
    ORDER BY p.sort_order
  ) t;

  -- ============ Build result ============
  v_result := jsonb_build_object(
    'mrr', v_mrr,
    'arr', v_arr,
    'arpu', v_arpu,
    'revenue_12m', v_revenue_12m,
    'open_amount', v_open_amount,
    'overdue_amount', v_overdue_amount,
    'counts', jsonb_build_object(
      'total_orgs', v_total_orgs,
      'active', v_active_count,
      'trialing', v_trial_count,
      'past_due', v_past_due_count,
      'canceled', v_canceled_count
    ),
    'growth_12m', COALESCE(v_growth, '[]'::jsonb),
    'revenue_series_12m', COALESCE(v_revenue_series, '[]'::jsonb),
    'top_revenue', COALESCE(v_top_revenue, '[]'::jsonb),
    'top_overdue', COALESCE(v_top_overdue, '[]'::jsonb),
    'plan_breakdown', COALESCE(v_plan_breakdown, '[]'::jsonb),
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_saas_kpis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_kpis() TO authenticated;

COMMENT ON FUNCTION public.get_saas_kpis() IS
  'Returns SaaS executive KPIs (MRR, ARR, churn, growth, top customers). BackOffice only.';
