-- 1) RPC: propagate a benefit template from a holding org to all its subsidiaries (snapshot copy)
CREATE OR REPLACE FUNCTION public.propagate_benefit_to_subsidiaries(p_benefit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src record;
  v_holding_id uuid;
  v_inserted int := 0;
  v_skipped int := 0;
  r record;
BEGIN
  -- Load source benefit
  SELECT * INTO v_src FROM public.dp_benefits WHERE id = p_benefit_id;
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'Benefício não encontrado';
  END IF;
  v_holding_id := v_src.organization_id;

  -- Caller must be admin/owner of the holding (or master / backoffice)
  IF NOT (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), v_holding_id, ARRAY['owner','admin'])
    OR has_backoffice_role(ARRAY['master','backoffice_admin'])
  ) THEN
    RAISE EXCEPTION 'Permissão negada: somente owner/admin da Holding pode propagar benefícios';
  END IF;

  -- Holding must actually have subsidiaries
  IF NOT public.is_holding(v_holding_id) THEN
    RAISE EXCEPTION 'Organização atual não é uma Holding com filiadas';
  END IF;

  -- Iterate subsidiaries
  FOR r IN
    SELECT subsidiary_id FROM public.get_all_subsidiary_ids(v_holding_id)
  LOOP
    -- Skip if a benefit with the same name already exists in the subsidiary
    IF EXISTS (
      SELECT 1 FROM public.dp_benefits
      WHERE organization_id = r.subsidiary_id
        AND lower(name) = lower(v_src.name)
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.dp_benefits (
      organization_id, user_id, name, type, default_value,
      description, active, category
    ) VALUES (
      r.subsidiary_id, auth.uid(), v_src.name, v_src.type, v_src.default_value,
      v_src.description, v_src.active, v_src.category
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.propagate_benefit_to_subsidiaries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propagate_benefit_to_subsidiaries(uuid) TO authenticated;

-- 2) Validation trigger: plano_saude requires custom_value > 0 (no default inheritance)
CREATE OR REPLACE FUNCTION public.validate_plano_saude_custom_value()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_category text;
BEGIN
  IF NEW.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT category INTO v_category FROM public.dp_benefits WHERE id = NEW.benefit_id;

  IF v_category = 'plano_saude' THEN
    IF NEW.custom_value IS NULL OR NEW.custom_value <= 0 THEN
      RAISE EXCEPTION 'Plano de Saúde exige informar o valor mensal do colaborador (não há valor padrão).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_plano_saude_custom_value ON public.employee_benefits;
CREATE TRIGGER trg_validate_plano_saude_custom_value
BEFORE INSERT OR UPDATE ON public.employee_benefits
FOR EACH ROW
EXECUTE FUNCTION public.validate_plano_saude_custom_value();