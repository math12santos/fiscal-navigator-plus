
-- ============================================================================
-- 1. Tabela internal_transfers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.internal_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  to_bank_account_id   uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  data date NOT NULL,
  descricao text,
  notes text,
  status text NOT NULL DEFAULT 'aguardando_contraparte'
    CHECK (status IN ('aguardando_contraparte','completa')),
  from_cashflow_entry_id uuid REFERENCES public.cashflow_entries(id) ON DELETE SET NULL,
  to_cashflow_entry_id   uuid REFERENCES public.cashflow_entries(id) ON DELETE SET NULL,
  from_bank_statement_entry_id uuid REFERENCES public.bank_statement_entries(id) ON DELETE SET NULL,
  to_bank_statement_entry_id   uuid REFERENCES public.bank_statement_entries(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_bank_account_id <> to_bank_account_id)
);

CREATE INDEX IF NOT EXISTS internal_transfers_org_idx ON public.internal_transfers(organization_id, data DESC);
CREATE INDEX IF NOT EXISTS internal_transfers_status_idx ON public.internal_transfers(organization_id, status);

ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_transfers_select" ON public.internal_transfers
  FOR SELECT USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "internal_transfers_insert" ON public.internal_transfers
  FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "internal_transfers_update" ON public.internal_transfers
  FOR UPDATE USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "internal_transfers_delete" ON public.internal_transfers
  FOR DELETE USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_internal_transfers_updated
  BEFORE UPDATE ON public.internal_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. Colunas em cashflow_entries para transferência e estorno
-- ============================================================================
ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES public.internal_transfers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_estorno boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estorno_de_entry_id uuid REFERENCES public.cashflow_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornado_por_entry_id uuid REFERENCES public.cashflow_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cashflow_transfer_idx ON public.cashflow_entries(transfer_id) WHERE transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cashflow_estorno_idx ON public.cashflow_entries(estorno_de_entry_id) WHERE estorno_de_entry_id IS NOT NULL;
-- Garante no máximo um estorno por entrada original
CREATE UNIQUE INDEX IF NOT EXISTS cashflow_estorno_unique_per_original
  ON public.cashflow_entries(estorno_de_entry_id)
  WHERE estorno_de_entry_id IS NOT NULL;

-- ============================================================================
-- 3. Novo status no staging
-- ============================================================================
ALTER TABLE public.bank_statement_staging
  DROP CONSTRAINT IF EXISTS bank_statement_staging_status_chk;
ALTER TABLE public.bank_statement_staging
  ADD CONSTRAINT bank_statement_staging_status_chk
  CHECK (status IN ('pendente','importado','vinculado','vinculado_parcial','descartado','erro_validacao'));

-- ============================================================================
-- 4. resolve_correct_and_retry — bloqueia alteração de data/valor já válidos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_correct_and_retry(
  p_staging_id uuid, p_data date, p_valor numeric, p_descricao text, p_documento text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_staging public.bank_statement_staging;
  v_new_bse_id uuid;
  v_orig_data date;
  v_orig_valor numeric;
  v_data date := p_data;
  v_valor numeric := p_valor;
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
  IF p_descricao IS NULL OR length(trim(p_descricao)) = 0 THEN
    RAISE EXCEPTION 'Descrição é obrigatória.';
  END IF;

  -- Imutabilidade: se o parser original entregou data/valor, mantém os do extrato
  v_orig_data  := NULLIF(v_staging.parsed->>'data','')::date;
  v_orig_valor := NULLIF(v_staging.parsed->>'valor','')::numeric;

  IF v_orig_data IS NOT NULL THEN
    IF p_data IS DISTINCT FROM v_orig_data THEN
      INSERT INTO public.audit_log(user_id, organization_id, entity_type, entity_id, action, old_data, new_data)
      VALUES (auth.uid(), v_staging.organization_id, 'bank_statement_staging', v_staging.id,
              'imutabilidade_extrato_recusada',
              jsonb_build_object('campo','data','original',v_orig_data,'tentativa',p_data), NULL);
    END IF;
    v_data := v_orig_data;
  ELSIF p_data IS NULL THEN
    RAISE EXCEPTION 'Data é obrigatória (parser não conseguiu ler).';
  END IF;

  IF v_orig_valor IS NOT NULL THEN
    IF p_valor IS DISTINCT FROM v_orig_valor THEN
      INSERT INTO public.audit_log(user_id, organization_id, entity_type, entity_id, action, old_data, new_data)
      VALUES (auth.uid(), v_staging.organization_id, 'bank_statement_staging', v_staging.id,
              'imutabilidade_extrato_recusada',
              jsonb_build_object('campo','valor','original',v_orig_valor,'tentativa',p_valor), NULL);
    END IF;
    v_valor := v_orig_valor;
  ELSIF p_valor IS NULL THEN
    RAISE EXCEPTION 'Valor é obrigatório (parser não conseguiu ler).';
  END IF;

  IF v_staging.bank_statement_entry_id IS NOT NULL THEN
    UPDATE public.bank_statement_entries
    SET data = v_data, valor = v_valor, descricao = p_descricao, documento = p_documento
    WHERE id = v_staging.bank_statement_entry_id
    RETURNING id INTO v_new_bse_id;
  ELSE
    INSERT INTO public.bank_statement_entries(
      organization_id, user_id, bank_account_id, data, descricao, valor, documento,
      import_id, source_ref, status
    ) VALUES (
      v_staging.organization_id, v_staging.user_id, v_staging.bank_account_id,
      v_data, p_descricao, v_valor, p_documento,
      v_staging.import_id, 'staging:'||v_staging.id::text, 'pendente'
    )
    ON CONFLICT (organization_id, bank_account_id, source_ref) DO UPDATE
      SET data = EXCLUDED.data, valor = EXCLUDED.valor,
          descricao = EXCLUDED.descricao, documento = EXCLUDED.documento
    RETURNING id INTO v_new_bse_id;
  END IF;

  UPDATE public.bank_statement_staging
  SET status = 'importado',
      parsed = parsed || jsonb_build_object('data', v_data, 'valor', v_valor,
                                              'descricao', p_descricao, 'documento', p_documento),
      errors = ARRAY[]::text[],
      bank_statement_entry_id = v_new_bse_id,
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_staging_id;

  RETURN jsonb_build_object('ok', true, 'bank_statement_entry_id', v_new_bse_id,
                            'data_aplicada', v_data, 'valor_aplicado', v_valor);
END;
$$;

-- ============================================================================
-- 5. resolve_create_cashflow — cria lançamento já realizado a partir do extrato
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_create_cashflow(
  p_staging_id uuid,
  p_descricao text,
  p_account_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_staging public.bank_statement_staging;
  v_data date; v_valor numeric; v_documento text;
  v_tipo text; v_status text; v_signed numeric;
  v_new_cf_id uuid; v_new_bse_id uuid;
BEGIN
  SELECT * INTO v_staging FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staging line not found'; END IF;
  IF NOT is_org_member(auth.uid(), v_staging.organization_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF v_staging.status NOT IN ('pendente','erro_validacao','importado') THEN
    RAISE EXCEPTION 'Linha já resolvida (%).', v_staging.status;
  END IF;

  v_data := NULLIF(v_staging.parsed->>'data','')::date;
  v_signed := NULLIF(v_staging.parsed->>'valor','')::numeric;
  v_documento := NULLIF(v_staging.parsed->>'documento','');
  IF v_data IS NULL OR v_signed IS NULL THEN
    RAISE EXCEPTION 'Linha sem data/valor — complemente os dados antes.';
  END IF;
  IF p_descricao IS NULL OR length(trim(p_descricao)) = 0 THEN
    RAISE EXCEPTION 'Descrição é obrigatória.';
  END IF;

  v_valor := abs(v_signed);
  v_tipo := CASE WHEN v_signed >= 0 THEN 'entrada' ELSE 'saida' END;
  v_status := CASE WHEN v_tipo = 'entrada' THEN 'recebido' ELSE 'pago' END;

  PERFORM set_config('app.allow_realize', 'on', true);

  INSERT INTO public.cashflow_entries(
    organization_id, user_id, tipo, categoria, descricao,
    valor_previsto, valor_realizado, data_prevista, data_realizada,
    status, account_id, cost_center_id, entity_id, contract_id,
    notes, source, source_ref, conta_bancaria_id
  ) VALUES (
    v_staging.organization_id, auth.uid(), v_tipo, p_categoria, p_descricao,
    v_valor, v_valor, v_data, v_data,
    v_status, p_account_id, p_cost_center_id, p_entity_id, p_contract_id,
    p_notes, 'extrato_bancario', 'staging:'||v_staging.id::text, v_staging.bank_account_id
  ) RETURNING id INTO v_new_cf_id;

  IF v_staging.bank_statement_entry_id IS NOT NULL THEN
    UPDATE public.bank_statement_entries
    SET cashflow_entry_id = v_new_cf_id, status = 'conciliado',
        reconciled_at = now(), reconciled_by = auth.uid(),
        data = v_data, valor = v_signed, descricao = p_descricao,
        documento = COALESCE(v_documento, documento)
    WHERE id = v_staging.bank_statement_entry_id
    RETURNING id INTO v_new_bse_id;
  ELSE
    INSERT INTO public.bank_statement_entries(
      organization_id, user_id, bank_account_id, data, descricao, valor, documento,
      import_id, source_ref, status, cashflow_entry_id, reconciled_at, reconciled_by
    ) VALUES (
      v_staging.organization_id, v_staging.user_id, v_staging.bank_account_id,
      v_data, p_descricao, v_signed, v_documento,
      v_staging.import_id, 'staging:'||v_staging.id::text,
      'conciliado', v_new_cf_id, now(), auth.uid()
    )
    ON CONFLICT (organization_id, bank_account_id, source_ref) DO UPDATE
      SET cashflow_entry_id = EXCLUDED.cashflow_entry_id, status = 'conciliado',
          reconciled_at = now(), reconciled_by = auth.uid()
    RETURNING id INTO v_new_bse_id;
  END IF;

  UPDATE public.bank_statement_staging
  SET status = 'vinculado',
      bank_statement_entry_id = v_new_bse_id,
      resolution = COALESCE(resolution,'{}'::jsonb)
                   || jsonb_build_object('via','create_from_statement',
                                          'cashflow_entry_id', v_new_cf_id),
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_staging_id;

  INSERT INTO public.audit_log(user_id, organization_id, entity_type, entity_id, action, new_data)
  VALUES (auth.uid(), v_staging.organization_id, 'cashflow_entries', v_new_cf_id,
          'cashflow_created_from_statement',
          jsonb_build_object('staging_id', p_staging_id, 'bank_statement_entry_id', v_new_bse_id));

  RETURN jsonb_build_object('ok', true,
    'cashflow_entry_id', v_new_cf_id,
    'bank_statement_entry_id', v_new_bse_id);
END;
$$;

-- ============================================================================
-- 6. search_transfer_counterparties — sugere par de transferência interna
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_transfer_counterparties(
  p_staging_id uuid, p_window_days int DEFAULT 3
)
RETURNS TABLE(
  staging_id uuid, bank_account_id uuid, bank_account_nome text,
  data date, valor numeric, descricao text, status text, match_score numeric
)
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  v_staging public.bank_statement_staging;
  v_data date; v_valor numeric;
BEGIN
  SELECT * INTO v_staging FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (is_org_member(auth.uid(), v_staging.organization_id)
          OR has_backoffice_org_access(v_staging.organization_id)) THEN RETURN; END IF;

  v_data := NULLIF(v_staging.parsed->>'data','')::date;
  v_valor := NULLIF(v_staging.parsed->>'valor','')::numeric;
  IF v_data IS NULL OR v_valor IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT s.id, s.bank_account_id, ba.nome,
         (s.parsed->>'data')::date,
         (s.parsed->>'valor')::numeric,
         (s.parsed->>'descricao'),
         s.status,
         (1.0 - LEAST(abs((s.parsed->>'data')::date - v_data), p_window_days)::numeric / GREATEST(p_window_days,1))::numeric
  FROM public.bank_statement_staging s
  LEFT JOIN public.bank_accounts ba ON ba.id = s.bank_account_id
  WHERE s.organization_id = v_staging.organization_id
    AND s.id <> v_staging.id
    AND s.bank_account_id <> v_staging.bank_account_id
    AND s.status IN ('pendente','erro_validacao','importado')
    AND (s.parsed->>'valor')::numeric = -v_valor
    AND abs((s.parsed->>'data')::date - v_data) <= p_window_days
  ORDER BY abs((s.parsed->>'data')::date - v_data) ASC,
           (s.parsed->>'data')::date DESC;
END;
$$;

-- ============================================================================
-- 7. resolve_mark_as_transfer — registra transferência (com ou sem contraparte)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_mark_as_transfer(
  p_staging_id uuid,
  p_counterparty_staging_id uuid DEFAULT NULL,
  p_descricao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_a public.bank_statement_staging;
  v_b public.bank_statement_staging;
  v_a_data date; v_a_valor numeric;
  v_b_data date; v_b_valor numeric;
  v_from_account uuid; v_to_account uuid;
  v_data date; v_valor numeric;
  v_transfer_id uuid;
  v_cf_from uuid; v_cf_to uuid;
  v_bse_a uuid; v_bse_b uuid;

  -- helper inline para criar/atualizar BSE
BEGIN
  SELECT * INTO v_a FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staging A not found'; END IF;
  IF NOT is_org_member(auth.uid(), v_a.organization_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_a.status NOT IN ('pendente','erro_validacao','importado') THEN
    RAISE EXCEPTION 'Linha A já resolvida (%).', v_a.status;
  END IF;
  v_a_data := NULLIF(v_a.parsed->>'data','')::date;
  v_a_valor := NULLIF(v_a.parsed->>'valor','')::numeric;
  IF v_a_data IS NULL OR v_a_valor IS NULL THEN
    RAISE EXCEPTION 'Linha A sem data/valor.';
  END IF;

  IF p_counterparty_staging_id IS NOT NULL THEN
    SELECT * INTO v_b FROM public.bank_statement_staging WHERE id = p_counterparty_staging_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Staging B not found'; END IF;
    IF v_b.organization_id <> v_a.organization_id THEN RAISE EXCEPTION 'Contraparte de outra organização.'; END IF;
    IF v_b.bank_account_id = v_a.bank_account_id THEN RAISE EXCEPTION 'Contraparte na mesma conta.'; END IF;
    IF v_b.status NOT IN ('pendente','erro_validacao','importado') THEN
      RAISE EXCEPTION 'Linha B já resolvida (%).', v_b.status;
    END IF;
    v_b_data := NULLIF(v_b.parsed->>'data','')::date;
    v_b_valor := NULLIF(v_b.parsed->>'valor','')::numeric;
    IF v_b_data IS NULL OR v_b_valor IS NULL THEN
      RAISE EXCEPTION 'Linha B sem data/valor.';
    END IF;
    IF v_b_valor <> -v_a_valor THEN
      RAISE EXCEPTION 'Valores não casam (% vs %).', v_a_valor, v_b_valor;
    END IF;
  END IF;

  -- Identifica from/to
  IF v_a_valor < 0 THEN
    v_from_account := v_a.bank_account_id;
    v_to_account   := COALESCE(v_b.bank_account_id, NULL);
  ELSE
    v_to_account   := v_a.bank_account_id;
    v_from_account := COALESCE(v_b.bank_account_id, NULL);
  END IF;
  v_valor := abs(v_a_valor);
  v_data := COALESCE(v_a_data, v_b_data);

  PERFORM set_config('app.allow_realize', 'on', true);

  INSERT INTO public.internal_transfers(
    organization_id, from_bank_account_id, to_bank_account_id,
    valor, data, descricao, status, created_by
  ) VALUES (
    v_a.organization_id,
    COALESCE(v_from_account, v_a.bank_account_id),
    COALESCE(v_to_account, v_a.bank_account_id),
    v_valor, v_data, COALESCE(p_descricao, v_a.parsed->>'descricao', 'Transferência interna'),
    CASE WHEN p_counterparty_staging_id IS NULL THEN 'aguardando_contraparte' ELSE 'completa' END,
    auth.uid()
  ) RETURNING id INTO v_transfer_id;

  -- Cria leg de SAÍDA
  INSERT INTO public.cashflow_entries(
    organization_id, user_id, tipo, categoria, descricao,
    valor_previsto, valor_realizado, data_prevista, data_realizada,
    status, source, source_ref, conta_bancaria_id, transfer_id, impacto_orcamento
  ) VALUES (
    v_a.organization_id, auth.uid(), 'saida', 'transferencia_interna',
    COALESCE(p_descricao, v_a.parsed->>'descricao', 'Transferência interna') || ' (saída)',
    v_valor, v_valor, v_data, v_data,
    'pago', 'extrato_bancario', 'transfer:'||v_transfer_id::text||':from',
    COALESCE(v_from_account, v_a.bank_account_id), v_transfer_id, false
  ) RETURNING id INTO v_cf_from;

  IF p_counterparty_staging_id IS NOT NULL THEN
    INSERT INTO public.cashflow_entries(
      organization_id, user_id, tipo, categoria, descricao,
      valor_previsto, valor_realizado, data_prevista, data_realizada,
      status, source, source_ref, conta_bancaria_id, transfer_id, impacto_orcamento
    ) VALUES (
      v_a.organization_id, auth.uid(), 'entrada', 'transferencia_interna',
      COALESCE(p_descricao, v_a.parsed->>'descricao', 'Transferência interna') || ' (entrada)',
      v_valor, v_valor, v_data, v_data,
      'recebido', 'extrato_bancario', 'transfer:'||v_transfer_id::text||':to',
      COALESCE(v_to_account, v_b.bank_account_id), v_transfer_id, false
    ) RETURNING id INTO v_cf_to;
  END IF;

  -- BSE para A
  IF v_a.bank_statement_entry_id IS NOT NULL THEN
    UPDATE public.bank_statement_entries
    SET cashflow_entry_id = CASE WHEN v_a_valor < 0 THEN v_cf_from ELSE v_cf_to END,
        status = 'conciliado', reconciled_at = now(), reconciled_by = auth.uid()
    WHERE id = v_a.bank_statement_entry_id
    RETURNING id INTO v_bse_a;
  ELSE
    INSERT INTO public.bank_statement_entries(
      organization_id, user_id, bank_account_id, data, descricao, valor,
      import_id, source_ref, status, cashflow_entry_id, reconciled_at, reconciled_by
    ) VALUES (
      v_a.organization_id, v_a.user_id, v_a.bank_account_id,
      v_a_data, COALESCE(v_a.parsed->>'descricao','Transferência interna'), v_a_valor,
      v_a.import_id, 'staging:'||v_a.id::text, 'conciliado',
      CASE WHEN v_a_valor < 0 THEN v_cf_from ELSE v_cf_to END,
      now(), auth.uid()
    )
    ON CONFLICT (organization_id, bank_account_id, source_ref) DO UPDATE
      SET cashflow_entry_id = EXCLUDED.cashflow_entry_id, status = 'conciliado',
          reconciled_at = now(), reconciled_by = auth.uid()
    RETURNING id INTO v_bse_a;
  END IF;

  UPDATE public.bank_statement_staging
  SET status = CASE WHEN p_counterparty_staging_id IS NULL THEN 'vinculado_parcial' ELSE 'vinculado' END,
      bank_statement_entry_id = v_bse_a,
      resolution = COALESCE(resolution,'{}'::jsonb)
                   || jsonb_build_object('via','transfer','transfer_id', v_transfer_id),
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = v_a.id;

  -- BSE para B (se contraparte fornecida)
  IF p_counterparty_staging_id IS NOT NULL THEN
    IF v_b.bank_statement_entry_id IS NOT NULL THEN
      UPDATE public.bank_statement_entries
      SET cashflow_entry_id = CASE WHEN v_b_valor < 0 THEN v_cf_from ELSE v_cf_to END,
          status = 'conciliado', reconciled_at = now(), reconciled_by = auth.uid()
      WHERE id = v_b.bank_statement_entry_id
      RETURNING id INTO v_bse_b;
    ELSE
      INSERT INTO public.bank_statement_entries(
        organization_id, user_id, bank_account_id, data, descricao, valor,
        import_id, source_ref, status, cashflow_entry_id, reconciled_at, reconciled_by
      ) VALUES (
        v_b.organization_id, v_b.user_id, v_b.bank_account_id,
        v_b_data, COALESCE(v_b.parsed->>'descricao','Transferência interna'), v_b_valor,
        v_b.import_id, 'staging:'||v_b.id::text, 'conciliado',
        CASE WHEN v_b_valor < 0 THEN v_cf_from ELSE v_cf_to END,
        now(), auth.uid()
      )
      ON CONFLICT (organization_id, bank_account_id, source_ref) DO UPDATE
        SET cashflow_entry_id = EXCLUDED.cashflow_entry_id, status = 'conciliado',
            reconciled_at = now(), reconciled_by = auth.uid()
      RETURNING id INTO v_bse_b;
    END IF;

    UPDATE public.bank_statement_staging
    SET status = 'vinculado', bank_statement_entry_id = v_bse_b,
        resolution = COALESCE(resolution,'{}'::jsonb)
                     || jsonb_build_object('via','transfer','transfer_id', v_transfer_id,
                                            'paired_with', v_a.id),
        resolved_by = auth.uid(), resolved_at = now()
    WHERE id = v_b.id;
  END IF;

  UPDATE public.internal_transfers
  SET from_cashflow_entry_id = v_cf_from,
      to_cashflow_entry_id = v_cf_to,
      from_bank_statement_entry_id = CASE WHEN v_a_valor < 0 THEN v_bse_a ELSE v_bse_b END,
      to_bank_statement_entry_id   = CASE WHEN v_a_valor >= 0 THEN v_bse_a ELSE v_bse_b END
  WHERE id = v_transfer_id;

  INSERT INTO public.audit_log(user_id, organization_id, entity_type, entity_id, action, new_data)
  VALUES (auth.uid(), v_a.organization_id, 'internal_transfers', v_transfer_id,
          'transfer_marked',
          jsonb_build_object('staging_a', v_a.id, 'staging_b', p_counterparty_staging_id));

  RETURN jsonb_build_object('ok', true, 'transfer_id', v_transfer_id,
                            'status', CASE WHEN p_counterparty_staging_id IS NULL THEN 'aguardando_contraparte' ELSE 'completa' END);
END;
$$;

-- ============================================================================
-- 8. search_reversal_candidates — busca realizado a ser estornado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_reversal_candidates(
  p_staging_id uuid, p_window_days int DEFAULT 90
)
RETURNS TABLE(
  cashflow_id uuid, descricao text, data_realizada date,
  valor_realizado numeric, tipo text, conta_bancaria_id uuid,
  match_score numeric
)
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  v_staging public.bank_statement_staging;
  v_data date; v_valor numeric; v_abs numeric; v_tipo_orig text;
BEGIN
  SELECT * INTO v_staging FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (is_org_member(auth.uid(), v_staging.organization_id)
          OR has_backoffice_org_access(v_staging.organization_id)) THEN RETURN; END IF;

  v_data := NULLIF(v_staging.parsed->>'data','')::date;
  v_valor := NULLIF(v_staging.parsed->>'valor','')::numeric;
  IF v_data IS NULL OR v_valor IS NULL THEN RETURN; END IF;
  v_abs := abs(v_valor);
  -- Linha de extrato com valor +X anula um pago anterior (saida); -X anula um recebido (entrada)
  v_tipo_orig := CASE WHEN v_valor > 0 THEN 'saida' ELSE 'entrada' END;

  RETURN QUERY
  SELECT c.id, c.descricao, c.data_realizada,
         c.valor_realizado, c.tipo, c.conta_bancaria_id,
         (1.0 - LEAST(abs(c.data_realizada - v_data), p_window_days)::numeric / GREATEST(p_window_days,1))::numeric
  FROM public.cashflow_entries c
  WHERE c.organization_id = v_staging.organization_id
    AND c.tipo = v_tipo_orig
    AND c.status IN ('pago','recebido','realizado')
    AND COALESCE(c.is_estorno, false) = false
    AND c.estornado_em IS NULL
    AND c.valor_realizado IS NOT NULL
    AND abs(c.valor_realizado - v_abs) < 0.01
    AND c.data_realizada IS NOT NULL
    AND abs(c.data_realizada - v_data) <= p_window_days
  ORDER BY abs(c.data_realizada - v_data) ASC, c.data_realizada DESC
  LIMIT 50;
END;
$$;

-- ============================================================================
-- 9. resolve_mark_as_reversal — anti-lançamento
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_mark_as_reversal(
  p_staging_id uuid, p_original_entry_id uuid, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_staging public.bank_statement_staging;
  v_orig public.cashflow_entries;
  v_data date; v_signed numeric; v_documento text;
  v_new_cf_id uuid; v_new_bse_id uuid;
  v_new_tipo text; v_new_status text;
BEGIN
  SELECT * INTO v_staging FROM public.bank_statement_staging WHERE id = p_staging_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staging not found'; END IF;
  IF NOT is_org_member(auth.uid(), v_staging.organization_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_staging.status NOT IN ('pendente','erro_validacao','importado') THEN
    RAISE EXCEPTION 'Linha já resolvida (%).', v_staging.status;
  END IF;

  SELECT * INTO v_orig FROM public.cashflow_entries
   WHERE id = p_original_entry_id AND organization_id = v_staging.organization_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento original não encontrado.'; END IF;
  IF COALESCE(v_orig.is_estorno, false) THEN RAISE EXCEPTION 'Não é possível estornar um estorno.'; END IF;
  IF v_orig.estornado_em IS NOT NULL THEN RAISE EXCEPTION 'Lançamento já estornado.'; END IF;
  IF v_orig.status NOT IN ('pago','recebido','realizado') THEN
    RAISE EXCEPTION 'Original precisa estar realizado para ser estornado.';
  END IF;

  v_data := NULLIF(v_staging.parsed->>'data','')::date;
  v_signed := NULLIF(v_staging.parsed->>'valor','')::numeric;
  v_documento := NULLIF(v_staging.parsed->>'documento','');
  IF v_data IS NULL OR v_signed IS NULL THEN
    RAISE EXCEPTION 'Linha sem data/valor.';
  END IF;
  IF abs(abs(v_signed) - COALESCE(v_orig.valor_realizado, v_orig.valor_previsto)) > 0.01 THEN
    RAISE EXCEPTION 'Valor do estorno (%) não casa com o original (%).',
      abs(v_signed), COALESCE(v_orig.valor_realizado, v_orig.valor_previsto);
  END IF;
  -- Sinal oposto: original saida (-) -> estorno entrada (+); original entrada (+) -> estorno saida (-)
  IF v_orig.tipo = 'saida' AND v_signed <= 0 THEN
    RAISE EXCEPTION 'Estorno de despesa precisa ser entrada (+) no extrato.';
  END IF;
  IF v_orig.tipo = 'entrada' AND v_signed >= 0 THEN
    RAISE EXCEPTION 'Estorno de receita precisa ser saída (-) no extrato.';
  END IF;

  v_new_tipo := CASE WHEN v_orig.tipo = 'saida' THEN 'entrada' ELSE 'saida' END;
  v_new_status := CASE WHEN v_new_tipo = 'entrada' THEN 'recebido' ELSE 'pago' END;

  PERFORM set_config('app.allow_realize', 'on', true);

  INSERT INTO public.cashflow_entries(
    organization_id, user_id, tipo, categoria, descricao,
    valor_previsto, valor_realizado, data_prevista, data_realizada,
    status, source, source_ref, conta_bancaria_id,
    is_estorno, estorno_de_entry_id, notes, impacto_orcamento
  ) VALUES (
    v_staging.organization_id, auth.uid(), v_new_tipo,
    COALESCE(v_orig.categoria, 'estorno'),
    'Estorno: ' || v_orig.descricao,
    abs(v_signed), abs(v_signed), v_data, v_data,
    v_new_status, 'extrato_bancario',
    'estorno:'||v_orig.id::text||':'||v_staging.id::text,
    v_staging.bank_account_id, true, v_orig.id, p_notes, false
  ) RETURNING id INTO v_new_cf_id;

  UPDATE public.cashflow_entries
  SET estornado_em = now(), estornado_por_entry_id = v_new_cf_id, updated_at = now()
  WHERE id = v_orig.id;

  IF v_staging.bank_statement_entry_id IS NOT NULL THEN
    UPDATE public.bank_statement_entries
    SET cashflow_entry_id = v_new_cf_id, status = 'conciliado',
        reconciled_at = now(), reconciled_by = auth.uid()
    WHERE id = v_staging.bank_statement_entry_id
    RETURNING id INTO v_new_bse_id;
  ELSE
    INSERT INTO public.bank_statement_entries(
      organization_id, user_id, bank_account_id, data, descricao, valor, documento,
      import_id, source_ref, status, cashflow_entry_id, reconciled_at, reconciled_by
    ) VALUES (
      v_staging.organization_id, v_staging.user_id, v_staging.bank_account_id,
      v_data, 'Estorno: ' || v_orig.descricao, v_signed, v_documento,
      v_staging.import_id, 'staging:'||v_staging.id::text,
      'conciliado', v_new_cf_id, now(), auth.uid()
    )
    ON CONFLICT (organization_id, bank_account_id, source_ref) DO UPDATE
      SET cashflow_entry_id = EXCLUDED.cashflow_entry_id, status = 'conciliado',
          reconciled_at = now(), reconciled_by = auth.uid()
    RETURNING id INTO v_new_bse_id;
  END IF;

  UPDATE public.bank_statement_staging
  SET status = 'vinculado', bank_statement_entry_id = v_new_bse_id,
      resolution = COALESCE(resolution,'{}'::jsonb)
                   || jsonb_build_object('via','reversal',
                                          'cashflow_entry_id', v_new_cf_id,
                                          'original_entry_id', v_orig.id),
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_staging_id;

  INSERT INTO public.audit_log(user_id, organization_id, entity_type, entity_id, action, new_data)
  VALUES (auth.uid(), v_staging.organization_id, 'cashflow_entries', v_new_cf_id,
          'cashflow_reversed',
          jsonb_build_object('original_entry_id', v_orig.id, 'staging_id', p_staging_id));

  RETURN jsonb_build_object('ok', true,
    'cashflow_entry_id', v_new_cf_id,
    'original_entry_id', v_orig.id,
    'bank_statement_entry_id', v_new_bse_id);
END;
$$;
