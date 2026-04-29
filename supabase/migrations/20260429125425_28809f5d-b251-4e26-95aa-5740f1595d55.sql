-- 1) Add columns to isolate event-sourced amounts from fixed payroll calculations
ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS eventos_proventos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eventos_descontos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eventos_atualizado_em timestamptz;

-- 2) Recompute function: aggregates payroll_events for a (run, employee) pair
--    and rewrites totals on payroll_items. Skips locked runs.
CREATE OR REPLACE FUNCTION public.recompute_payroll_item_from_events(
  p_run_id uuid,
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
  v_org_id uuid;
  v_user_id uuid;
  v_proventos numeric := 0;
  v_descontos numeric := 0;
BEGIN
  IF p_run_id IS NULL OR p_employee_id IS NULL THEN
    RETURN;
  END IF;

  SELECT locked, organization_id, user_id
    INTO v_locked, v_org_id, v_user_id
  FROM public.payroll_runs
  WHERE id = p_run_id;

  IF v_org_id IS NULL THEN
    RETURN; -- run not found
  END IF;

  IF v_locked IS TRUE THEN
    RAISE NOTICE 'Folha % está fechada — recálculo automático ignorado.', p_run_id;
    RETURN;
  END IF;

  -- Aggregate events of this employee within the run
  SELECT
    COALESCE(SUM(CASE WHEN signal = 'provento' THEN value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN signal = 'desconto' THEN value ELSE 0 END), 0)
  INTO v_proventos, v_descontos
  FROM public.payroll_events
  WHERE payroll_run_id = p_run_id
    AND employee_id = p_employee_id;

  -- Upsert the payroll_item row, recomputing totals from fixed + events
  INSERT INTO public.payroll_items (
    organization_id, payroll_run_id, employee_id, user_id,
    eventos_proventos, eventos_descontos, eventos_atualizado_em,
    total_bruto, total_descontos, total_liquido
  )
  VALUES (
    v_org_id, p_run_id, p_employee_id, v_user_id,
    v_proventos, v_descontos, now(),
    v_proventos, v_descontos, v_proventos - v_descontos
  )
  ON CONFLICT (payroll_run_id, employee_id) DO UPDATE
  SET
    eventos_proventos = EXCLUDED.eventos_proventos,
    eventos_descontos = EXCLUDED.eventos_descontos,
    eventos_atualizado_em = now(),
    total_bruto = COALESCE(payroll_items.salario_base,0)
                + COALESCE(payroll_items.horas_extras,0)
                + COALESCE(payroll_items.comissoes,0)
                + COALESCE(payroll_items.adicionais,0)
                + COALESCE(payroll_items.dsr,0)
                + EXCLUDED.eventos_proventos,
    total_descontos = COALESCE(payroll_items.inss_empregado,0)
                    + COALESCE(payroll_items.irrf,0)
                    + COALESCE(payroll_items.vt_desconto,0)
                    + COALESCE(payroll_items.faltas_desconto,0)
                    + COALESCE(payroll_items.outros_descontos,0)
                    + EXCLUDED.eventos_descontos,
    total_liquido = (
        COALESCE(payroll_items.salario_base,0)
      + COALESCE(payroll_items.horas_extras,0)
      + COALESCE(payroll_items.comissoes,0)
      + COALESCE(payroll_items.adicionais,0)
      + COALESCE(payroll_items.dsr,0)
      + EXCLUDED.eventos_proventos
    ) - (
        COALESCE(payroll_items.inss_empregado,0)
      + COALESCE(payroll_items.irrf,0)
      + COALESCE(payroll_items.vt_desconto,0)
      + COALESCE(payroll_items.faltas_desconto,0)
      + COALESCE(payroll_items.outros_descontos,0)
      + EXCLUDED.eventos_descontos
    );
END;
$$;

-- 3) Trigger function on payroll_events
CREATE OR REPLACE FUNCTION public.trg_payroll_events_sync_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.payroll_run_id IS NOT NULL THEN
      PERFORM public.recompute_payroll_item_from_events(OLD.payroll_run_id, OLD.employee_id);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE
  IF NEW.payroll_run_id IS NOT NULL THEN
    PERFORM public.recompute_payroll_item_from_events(NEW.payroll_run_id, NEW.employee_id);
  END IF;

  -- If UPDATE moved the event between runs/employees, also refresh the old pair
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payroll_run_id IS NOT NULL
       AND (OLD.payroll_run_id IS DISTINCT FROM NEW.payroll_run_id
            OR OLD.employee_id IS DISTINCT FROM NEW.employee_id) THEN
      PERFORM public.recompute_payroll_item_from_events(OLD.payroll_run_id, OLD.employee_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_events_sync_item ON public.payroll_events;
CREATE TRIGGER trg_payroll_events_sync_item
  AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_payroll_events_sync_item();

-- 4) Backfill: refresh all (run, employee) pairs that already have events
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT payroll_run_id, employee_id
    FROM public.payroll_events
    WHERE payroll_run_id IS NOT NULL
  LOOP
    PERFORM public.recompute_payroll_item_from_events(r.payroll_run_id, r.employee_id);
  END LOOP;
END $$;

-- 5) Bulk RPC used after manual "Calcular Folha" to reapply events on top of fixed values
CREATE OR REPLACE FUNCTION public.recompute_payroll_run_totals(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NOT (
    is_org_member(auth.uid(), (SELECT organization_id FROM public.payroll_runs WHERE id = p_run_id))
    OR has_backoffice_org_access((SELECT organization_id FROM public.payroll_runs WHERE id = p_run_id))
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  FOR r IN
    SELECT employee_id FROM public.payroll_items WHERE payroll_run_id = p_run_id
    UNION
    SELECT employee_id FROM public.payroll_events WHERE payroll_run_id = p_run_id
  LOOP
    PERFORM public.recompute_payroll_item_from_events(p_run_id, r.employee_id);
  END LOOP;
END;
$$;

-- Restrict execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.recompute_payroll_item_from_events(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_payroll_run_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_payroll_run_totals(uuid) TO authenticated;