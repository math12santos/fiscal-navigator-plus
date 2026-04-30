
-- ============================================================
-- TI Fase 4-5: Auditoria, Alertas e TCO
-- ============================================================

-- 1. Novas colunas de suporte
ALTER TABLE public.it_equipment_movements
  ADD COLUMN IF NOT EXISTS cost numeric(14,2) DEFAULT 0;

ALTER TABLE public.it_tickets
  ADD COLUMN IF NOT EXISTS hours_spent numeric(8,2) DEFAULT 0;

ALTER TABLE public.it_config
  ADD COLUMN IF NOT EXISTS technician_hourly_cost numeric(10,2) DEFAULT 80;

-- 2. Trigger genérica de auditoria
CREATE OR REPLACE FUNCTION public.it_log_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_action it_audit_action;
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := ARRAY[]::text[];
  v_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_org := NEW.organization_id;
    v_after := to_jsonb(NEW);
    v_before := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_org := NEW.organization_id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_after) LOOP
      IF v_before -> v_key IS DISTINCT FROM v_after -> v_key THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;
    -- Pular se só updated_at mudou
    IF array_length(v_changed,1) = 1 AND v_changed[1] = 'updated_at' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_org := OLD.organization_id;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  INSERT INTO public.it_audit_log (organization_id, table_name, record_id, action, changed_by, before_data, after_data, changed_fields)
  VALUES (v_org, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), v_action, auth.uid(), v_before, v_after,
          CASE WHEN array_length(v_changed,1) > 0 THEN v_changed ELSE NULL END);

  RETURN COALESCE(NEW, OLD);
END $$;

-- Aplicar triggers em todas as tabelas relevantes
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['it_systems','it_equipment','it_telecom_links','it_tickets','it_sla_policies','it_equipment_movements']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_audit AFTER INSERT OR UPDATE OR DELETE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.it_log_changes()', t, t);
  END LOOP;
END $$;

-- 3. Dedupe de notifications por dia (para cron de alertas)
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications (user_id, reference_type, reference_id, ((created_at AT TIME ZONE 'UTC')::date));

-- 4. RPC: TCO consolidado
CREATE OR REPLACE FUNCTION public.it_compute_tco(p_org uuid, p_from date, p_to date)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  name text,
  category text,
  direct_cost numeric,
  depreciation numeric,
  incident_cost numeric,
  movement_cost numeric,
  tco_total numeric,
  users_count integer,
  tco_per_user numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hourly numeric;
BEGIN
  IF NOT (is_org_member(auth.uid(), p_org) OR has_backoffice_org_access(p_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT COALESCE(technician_hourly_cost, 80) INTO v_hourly
  FROM public.it_config WHERE organization_id = p_org LIMIT 1;
  v_hourly := COALESCE(v_hourly, 80);

  RETURN QUERY
  -- Sistemas
  SELECT
    'system'::text AS entity_type,
    s.id AS entity_id,
    s.name,
    s.category::text,
    COALESCE((SELECT SUM(ABS(COALESCE(ce.valor_realizado, ce.valor_previsto)))
              FROM public.cashflow_entries ce
              WHERE ce.organization_id = p_org
                AND ce.source = 'ti'
                AND ce.source_ref LIKE 'it_system:' || s.id || ':%'
                AND ce.data_prevista BETWEEN p_from AND p_to), 0) AS direct_cost,
    0::numeric AS depreciation,
    COALESCE((SELECT SUM(t.hours_spent) * v_hourly
              FROM public.it_tickets t
              WHERE t.organization_id = p_org
                AND t.system_id = s.id
                AND t.created_at::date BETWEEN p_from AND p_to), 0) AS incident_cost,
    0::numeric AS movement_cost,
    0::numeric AS tco_total,
    s.users_count,
    0::numeric AS tco_per_user
  FROM public.it_systems s
  WHERE s.organization_id = p_org

  UNION ALL

  -- Equipamentos
  SELECT
    'equipment'::text,
    e.id,
    e.name,
    e.equipment_type::text,
    COALESCE((SELECT SUM(ABS(COALESCE(ce.valor_realizado, ce.valor_previsto)))
              FROM public.cashflow_entries ce
              WHERE ce.organization_id = p_org
                AND ce.source = 'ti'
                AND ce.source_ref LIKE 'it_equipment_installment:' || e.id || ':%'
                AND ce.data_prevista BETWEEN p_from AND p_to), 0),
    COALESCE((SELECT SUM(d.depreciation_value)
              FROM public.it_depreciation_schedule d
              WHERE d.equipment_id = e.id
                AND d.period_date BETWEEN p_from AND p_to), 0),
    COALESCE((SELECT SUM(t.hours_spent) * v_hourly
              FROM public.it_tickets t
              WHERE t.organization_id = p_org
                AND t.equipment_id = e.id
                AND t.created_at::date BETWEEN p_from AND p_to), 0),
    COALESCE((SELECT SUM(m.cost)
              FROM public.it_equipment_movements m
              WHERE m.equipment_id = e.id
                AND m.movement_date BETWEEN p_from AND p_to), 0),
    0::numeric,
    1,
    0::numeric
  FROM public.it_equipment e
  WHERE e.organization_id = p_org;
END $$;

-- Wrapper que aplica somatórios finais (tco_total e tco_per_user)
CREATE OR REPLACE FUNCTION public.it_tco_summary(p_org uuid, p_from date, p_to date)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  name text,
  category text,
  direct_cost numeric,
  depreciation numeric,
  incident_cost numeric,
  movement_cost numeric,
  tco_total numeric,
  users_count integer,
  tco_per_user numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    entity_type, entity_id, name, category,
    direct_cost, depreciation, incident_cost, movement_cost,
    (direct_cost + depreciation + incident_cost + movement_cost) AS tco_total,
    GREATEST(users_count, 1) AS users_count,
    CASE WHEN GREATEST(users_count, 1) > 0
         THEN ROUND((direct_cost + depreciation + incident_cost + movement_cost) / GREATEST(users_count, 1), 2)
         ELSE 0 END AS tco_per_user
  FROM public.it_compute_tco(p_org, p_from, p_to);
$$;
