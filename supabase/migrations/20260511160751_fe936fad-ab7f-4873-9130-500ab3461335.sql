-- 1) Columns to track match outcome per statement line
ALTER TABLE public.bank_statement_entries
  ADD COLUMN IF NOT EXISTS match_score numeric,
  ADD COLUMN IF NOT EXISTS match_bucket text;

CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_bucket
  ON public.bank_statement_entries (organization_id, match_bucket)
  WHERE status = 'pendente';

-- 2) Coverage classification (per import or per org)
CREATE OR REPLACE FUNCTION public.classify_statement_coverage(
  p_org_id uuid,
  p_import_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched int := 0;
  v_suggestion int := 0;
  v_unplanned int := 0;
  v_total int := 0;
  r record;
  v_top_score numeric;
  v_bucket text;
BEGIN
  -- Permission: caller must belong to the org (or be master)
  IF NOT (public.is_org_member(p_org_id) OR public.has_role(auth.uid(), 'master'::public.app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR r IN
    SELECT id
    FROM public.bank_statement_entries
    WHERE organization_id = p_org_id
      AND status = 'pendente'
      AND (p_import_id IS NULL OR import_id = p_import_id)
  LOOP
    v_total := v_total + 1;

    SELECT MAX(score) INTO v_top_score
    FROM public.match_statement_to_cashflow_v2(r.id);

    IF v_top_score IS NULL THEN
      v_bucket := 'nao_previsto';
      v_unplanned := v_unplanned + 1;
    ELSIF v_top_score >= 0.85 THEN
      v_bucket := 'casado';
      v_matched := v_matched + 1;
    ELSIF v_top_score >= 0.50 THEN
      v_bucket := 'sugestao';
      v_suggestion := v_suggestion + 1;
    ELSE
      v_bucket := 'nao_previsto';
      v_unplanned := v_unplanned + 1;
    END IF;

    UPDATE public.bank_statement_entries
       SET match_score = COALESCE(v_top_score, 0),
           match_bucket = v_bucket
     WHERE id = r.id;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'casado', v_matched,
    'sugestao', v_suggestion,
    'nao_previsto', v_unplanned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.classify_statement_coverage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classify_statement_coverage(uuid, uuid) TO authenticated;

-- 3) Materialize unplanned statement line as realized cashflow + reconcile
CREATE OR REPLACE FUNCTION public.materialize_unplanned_statement_entry(
  p_statement_id uuid,
  p_classification jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  v_cashflow_id uuid;
  v_tipo text;
  v_account_id uuid := NULLIF((p_classification->>'account_id'), '')::uuid;
  v_cost_center_id uuid := NULLIF((p_classification->>'cost_center_id'), '')::uuid;
  v_entity_id uuid := NULLIF((p_classification->>'entity_id'), '')::uuid;
  v_competencia text := NULLIF((p_classification->>'competencia'), '');
  v_notes text := NULLIF((p_classification->>'notes'), '');
  v_natureza text := COALESCE(NULLIF((p_classification->>'natureza_contabil'), ''), 'caixa');
  v_descricao text;
BEGIN
  SELECT * INTO s FROM public.bank_statement_entries WHERE id = p_statement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'statement entry not found';
  END IF;

  IF NOT (public.is_org_member(s.organization_id) OR public.has_role(auth.uid(), 'master'::public.app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF s.cashflow_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'statement already linked to cashflow';
  END IF;

  v_tipo := CASE WHEN s.valor >= 0 THEN 'receita' ELSE 'despesa' END;
  v_descricao := COALESCE(v_notes, s.descricao);

  INSERT INTO public.cashflow_entries (
    organization_id, user_id,
    tipo, descricao,
    valor_previsto, valor_realizado,
    data_prevista, data_realizada,
    status, source, source_ref,
    account_id, cost_center_id, entity_id,
    competencia, natureza_contabil,
    documento, notes,
    conta_bancaria_id,
    impacto_fluxo_caixa, afeta_caixa_no_vencimento
  ) VALUES (
    s.organization_id, COALESCE(auth.uid(), s.user_id),
    v_tipo, v_descricao,
    ABS(s.valor), ABS(s.valor),
    s.data, s.data,
    'realizado', 'conciliacao', 'statement:' || s.id::text,
    v_account_id, v_cost_center_id, v_entity_id,
    COALESCE(v_competencia, to_char(s.data, 'YYYY-MM')),
    v_natureza,
    s.documento, COALESCE(v_notes, s.descricao),
    s.bank_account_id,
    true, true
  )
  RETURNING id INTO v_cashflow_id;

  UPDATE public.bank_statement_entries
     SET status = 'conciliado',
         cashflow_entry_id = v_cashflow_id,
         reconciled_at = now(),
         reconciled_by = auth.uid(),
         match_bucket = 'classificado',
         match_score = 1.0
   WHERE id = p_statement_id;

  RETURN v_cashflow_id;
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_unplanned_statement_entry(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_unplanned_statement_entry(uuid, jsonb) TO authenticated;