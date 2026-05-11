-- RPC: Propagate organization_modules from a Holding to all its subsidiaries
CREATE OR REPLACE FUNCTION public.propagate_modules_to_subsidiaries(
  p_holding_id uuid,
  p_overwrite boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_subs int := 0;
  r record;
  m record;
  v_existing record;
BEGIN
  -- Permission check
  IF NOT (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), p_holding_id, ARRAY['owner','admin'])
    OR has_backoffice_role(ARRAY['master','backoffice_admin'])
  ) THEN
    RAISE EXCEPTION 'Permissão negada: somente owner/admin da Holding pode propagar módulos';
  END IF;

  IF NOT public.is_holding(p_holding_id) THEN
    RAISE EXCEPTION 'Organização atual não é uma Holding com filiadas';
  END IF;

  FOR r IN SELECT subsidiary_id FROM public.get_all_subsidiary_ids(p_holding_id) LOOP
    v_subs := v_subs + 1;
    FOR m IN
      SELECT module_key, enabled FROM public.organization_modules
      WHERE organization_id = p_holding_id
    LOOP
      SELECT * INTO v_existing FROM public.organization_modules
      WHERE organization_id = r.subsidiary_id AND module_key = m.module_key;

      IF v_existing IS NULL THEN
        INSERT INTO public.organization_modules (organization_id, module_key, enabled)
        VALUES (r.subsidiary_id, m.module_key, m.enabled);
        v_inserted := v_inserted + 1;
      ELSIF p_overwrite AND v_existing.enabled IS DISTINCT FROM m.enabled THEN
        UPDATE public.organization_modules
        SET enabled = m.enabled
        WHERE id = v_existing.id;
        v_updated := v_updated + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'subsidiaries', v_subs,
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.propagate_modules_to_subsidiaries(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propagate_modules_to_subsidiaries(uuid, boolean) TO authenticated;