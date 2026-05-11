
CREATE TABLE IF NOT EXISTS public.bank_statement_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  import_id uuid REFERENCES public.data_imports(id) ON DELETE SET NULL,
  row_index int NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pendente',
  resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  bank_statement_entry_id uuid REFERENCES public.bank_statement_entries(id) ON DELETE SET NULL,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_statement_staging_status_chk
    CHECK (status IN ('pendente','importado','vinculado','descartado','erro_validacao'))
);

CREATE INDEX IF NOT EXISTS bank_statement_staging_org_status_idx
  ON public.bank_statement_staging(organization_id, status);
CREATE INDEX IF NOT EXISTS bank_statement_staging_import_idx
  ON public.bank_statement_staging(import_id);
CREATE INDEX IF NOT EXISTS bank_statement_staging_entry_idx
  ON public.bank_statement_staging(bank_statement_entry_id) WHERE bank_statement_entry_id IS NOT NULL;

ALTER TABLE public.bank_statement_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staging_select" ON public.bank_statement_staging;
DROP POLICY IF EXISTS "staging_insert" ON public.bank_statement_staging;
DROP POLICY IF EXISTS "staging_update" ON public.bank_statement_staging;
DROP POLICY IF EXISTS "staging_delete" ON public.bank_statement_staging;

CREATE POLICY "staging_select" ON public.bank_statement_staging
  FOR SELECT USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "staging_insert" ON public.bank_statement_staging
  FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = user_id);
CREATE POLICY "staging_update" ON public.bank_statement_staging
  FOR UPDATE USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "staging_delete" ON public.bank_statement_staging
  FOR DELETE USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

DROP TRIGGER IF EXISTS trg_bank_statement_staging_updated ON public.bank_statement_staging;
CREATE TRIGGER trg_bank_statement_staging_updated
  BEFORE UPDATE ON public.bank_statement_staging
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.list_unresolved_statement_lines(p_org uuid)
RETURNS TABLE (
  id uuid, bank_account_id uuid, bank_account_nome text, row_index int,
  raw jsonb, parsed jsonb, errors text[], status text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT s.id, s.bank_account_id, ba.nome, s.row_index, s.raw, s.parsed, s.errors, s.status, s.created_at
  FROM public.bank_statement_staging s
  LEFT JOIN public.bank_accounts ba ON ba.id = s.bank_account_id
  WHERE s.organization_id = p_org AND s.status IN ('pendente','erro_validacao')
  ORDER BY s.created_at DESC, s.row_index ASC;
$$;

CREATE OR REPLACE FUNCTION public.search_cashflow_for_link(
  p_org uuid, p_bank_account uuid, p_data date, p_valor numeric,
  p_include_already_reconciled boolean DEFAULT false, p_window_days int DEFAULT 30
)
RETURNS TABLE (
  cashflow_id uuid, descricao text, data_prevista date, data_realizada date,
  valor_previsto numeric, valor_realizado numeric, status text,
  account_id uuid, cost_center_id uuid, match_score numeric,
  ja_conciliado_com_id uuid, ja_conciliado_com_descricao text, ja_conciliado_com_data date
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH base AS (
    SELECT
      c.id, c.descricao, c.data_prevista, c.data_realizada,
      c.valor_previsto, c.valor_realizado, c.status,
      c.account_id, c.cost_center_id,
      (
        0.7 * GREATEST(0, 1 - ABS(ABS(COALESCE(c.valor_realizado, c.valor_previsto)) - ABS(p_valor))
                              / NULLIF(GREATEST(ABS(p_valor), 1), 0))
        + 0.3 * GREATEST(0, 1 - ABS(COALESCE(c.data_realizada, c.data_prevista) - p_data)::numeric
                                  / NULLIF(p_window_days, 0))
      )::numeric AS score
    FROM public.cashflow_entries c
    WHERE c.organization_id = p_org
      AND (c.conta_bancaria_id = p_bank_account OR c.conta_bancaria_id IS NULL)
      AND COALESCE(c.data_realizada, c.data_prevista)
            BETWEEN p_data - p_window_days AND p_data + p_window_days
      AND (p_include_already_reconciled OR c.status IN ('previsto','atrasado'))
      AND (SIGN(COALESCE(c.valor_realizado, c.valor_previsto)) = SIGN(p_valor)
           OR (c.tipo = 'saida' AND p_valor < 0)
           OR (c.tipo = 'entrada' AND p_valor > 0))
  )
  SELECT b.id, b.descricao, b.data_prevista, b.data_realizada,
         b.valor_previsto, b.valor_realizado, b.status, b.account_id, b.cost_center_id,
         b.score, bse.id, bse.descricao, bse.data
  FROM base b
  LEFT JOIN public.bank_statement_entries bse
    ON bse.cashflow_entry_id = b.id AND bse.status = 'conciliado'
  WHERE b.score > 0.05
  ORDER BY b.score DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.resolve_link_to_cashflow(
  p_staging_id uuid, p_cashflow_entry_id uuid, p_force_relink boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staging public.bank_statement_staging;
  v_cashflow public.cashflow_entries;
  v_existing_bse public.bank_statement_entries;
  v_new_bse_id uuid;
  v_data date; v_valor numeric; v_descricao text; v_documento text;
  v_previous_bse_id uuid;
BEGIN
  SELECT * INTO v_staging FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staging line not found'; END IF;
  IF NOT (is_org_member(auth.uid(), v_staging.organization_id)
          OR has_backoffice_org_access(v_staging.organization_id)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF v_staging.status NOT IN ('pendente','erro_validacao') THEN
    RAISE EXCEPTION 'Staging line already resolved (%).', v_staging.status;
  END IF;

  SELECT * INTO v_cashflow FROM public.cashflow_entries
    WHERE id = p_cashflow_entry_id AND organization_id = v_staging.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cashflow entry not found'; END IF;

  v_data := COALESCE((v_staging.parsed->>'data')::date, v_cashflow.data_prevista);
  v_valor := COALESCE((v_staging.parsed->>'valor')::numeric, v_cashflow.valor_previsto);
  v_descricao := COALESCE(NULLIF(v_staging.parsed->>'descricao',''), v_cashflow.descricao);
  v_documento := NULLIF(v_staging.parsed->>'documento','');

  IF v_data IS NULL OR v_valor IS NULL THEN
    RAISE EXCEPTION 'Linha sem data/valor — corrija antes de vincular.';
  END IF;

  SELECT * INTO v_existing_bse
  FROM public.bank_statement_entries
  WHERE cashflow_entry_id = p_cashflow_entry_id AND status = 'conciliado'
  LIMIT 1;

  IF FOUND THEN
    IF NOT p_force_relink THEN
      RAISE EXCEPTION 'Cashflow já conciliado com outra linha bancária. Use p_force_relink=true para substituir.';
    END IF;
    v_previous_bse_id := v_existing_bse.id;
    UPDATE public.bank_statement_entries
    SET status = 'pendente', cashflow_entry_id = NULL,
        reconciled_at = NULL, reconciled_by = NULL
    WHERE id = v_existing_bse.id;
    UPDATE public.bank_statement_staging
    SET status = 'pendente',
        resolution = COALESCE(resolution,'{}'::jsonb)
                     || jsonb_build_object('previa_conciliacao_substituida', true,
                                            'substituida_em', now(),
                                            'substituida_por_staging_id', p_staging_id)
    WHERE bank_statement_entry_id = v_existing_bse.id;
    INSERT INTO public.audit_log(user_id, organization_id, entity_type, entity_id, action, old_data, new_data)
    VALUES (auth.uid(), v_staging.organization_id, 'bank_statement_entries', v_existing_bse.id,
            'reconciliation_override',
            to_jsonb(v_existing_bse),
            jsonb_build_object('replaced_by_staging_id', p_staging_id, 'cashflow_entry_id', p_cashflow_entry_id));
  END IF;

  IF v_staging.bank_statement_entry_id IS NOT NULL THEN
    UPDATE public.bank_statement_entries
    SET cashflow_entry_id = p_cashflow_entry_id, status = 'conciliado',
        reconciled_at = now(), reconciled_by = auth.uid(),
        data = v_data, valor = v_valor, descricao = v_descricao,
        documento = COALESCE(v_documento, documento)
    WHERE id = v_staging.bank_statement_entry_id
    RETURNING id INTO v_new_bse_id;
  ELSE
    INSERT INTO public.bank_statement_entries(
      organization_id, user_id, bank_account_id, data, descricao, valor, documento, notes,
      import_id, source_ref, status, cashflow_entry_id, reconciled_at, reconciled_by
    ) VALUES (
      v_staging.organization_id, v_staging.user_id, v_staging.bank_account_id,
      v_data, v_descricao, v_valor, v_documento, NULLIF(v_staging.parsed->>'notes',''),
      v_staging.import_id, 'staging:'||v_staging.id::text,
      'conciliado', p_cashflow_entry_id, now(), auth.uid()
    )
    RETURNING id INTO v_new_bse_id;
  END IF;

  UPDATE public.cashflow_entries
  SET status = 'realizado', data_realizada = v_data, valor_realizado = v_valor, updated_at = now()
  WHERE id = p_cashflow_entry_id;

  UPDATE public.bank_statement_staging
  SET status = 'vinculado', bank_statement_entry_id = v_new_bse_id,
      resolution = COALESCE(resolution,'{}'::jsonb)
                   || jsonb_build_object('cashflow_entry_id', p_cashflow_entry_id,
                                          'force_relink', p_force_relink,
                                          'previous_bank_statement_entry_id', v_previous_bse_id),
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_staging_id;

  RETURN jsonb_build_object('ok', true, 'bank_statement_entry_id', v_new_bse_id,
                            'previous_bank_statement_entry_id', v_previous_bse_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_discard(
  p_staging_id uuid, p_category text, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_staging public.bank_statement_staging;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Motivo do descarte é obrigatório (mín. 3 caracteres).';
  END IF;
  SELECT * INTO v_staging FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staging line not found'; END IF;
  IF NOT (is_org_member(auth.uid(), v_staging.organization_id)
          OR has_backoffice_org_access(v_staging.organization_id)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF v_staging.status NOT IN ('pendente','erro_validacao') THEN
    RAISE EXCEPTION 'Linha já resolvida (%).', v_staging.status;
  END IF;

  UPDATE public.bank_statement_staging
  SET status = 'descartado',
      resolution = COALESCE(resolution,'{}'::jsonb)
                   || jsonb_build_object('category', p_category, 'reason', p_reason),
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_staging_id;

  INSERT INTO public.audit_log(user_id, organization_id, entity_type, entity_id, action, new_data)
  VALUES (auth.uid(), v_staging.organization_id, 'bank_statement_staging', p_staging_id,
          'discard', jsonb_build_object('category', p_category, 'reason', p_reason));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_correct_and_retry(
  p_staging_id uuid, p_data date, p_valor numeric, p_descricao text, p_documento text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_staging public.bank_statement_staging; v_new_bse_id uuid;
BEGIN
  SELECT * INTO v_staging FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staging line not found'; END IF;
  IF NOT (is_org_member(auth.uid(), v_staging.organization_id)
          OR has_backoffice_org_access(v_staging.organization_id)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF v_staging.status NOT IN ('pendente','erro_validacao') THEN
    RAISE EXCEPTION 'Linha já resolvida (%).', v_staging.status;
  END IF;
  IF p_data IS NULL OR p_valor IS NULL OR p_descricao IS NULL OR length(trim(p_descricao)) = 0 THEN
    RAISE EXCEPTION 'Data, valor e descrição são obrigatórios.';
  END IF;

  IF v_staging.bank_statement_entry_id IS NOT NULL THEN
    UPDATE public.bank_statement_entries
    SET data = p_data, valor = p_valor, descricao = p_descricao, documento = p_documento
    WHERE id = v_staging.bank_statement_entry_id
    RETURNING id INTO v_new_bse_id;
  ELSE
    INSERT INTO public.bank_statement_entries(
      organization_id, user_id, bank_account_id, data, descricao, valor, documento,
      import_id, source_ref, status
    ) VALUES (
      v_staging.organization_id, v_staging.user_id, v_staging.bank_account_id,
      p_data, p_descricao, p_valor, p_documento,
      v_staging.import_id, 'staging:'||v_staging.id::text, 'pendente'
    )
    ON CONFLICT (organization_id, bank_account_id, source_ref) DO UPDATE
      SET data = EXCLUDED.data, valor = EXCLUDED.valor,
          descricao = EXCLUDED.descricao, documento = EXCLUDED.documento
    RETURNING id INTO v_new_bse_id;
  END IF;

  UPDATE public.bank_statement_staging
  SET status = 'importado',
      parsed = parsed || jsonb_build_object('data', p_data, 'valor', p_valor,
                                              'descricao', p_descricao, 'documento', p_documento),
      errors = ARRAY[]::text[],
      bank_statement_entry_id = v_new_bse_id,
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_staging_id;

  RETURN jsonb_build_object('ok', true, 'bank_statement_entry_id', v_new_bse_id);
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bump_org_data_version') THEN
    BEGIN
      EXECUTE 'CREATE TRIGGER trg_bump_org_v_bss
               AFTER INSERT OR UPDATE OR DELETE ON public.bank_statement_staging
               FOR EACH ROW EXECUTE FUNCTION public.bump_org_data_version()';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
