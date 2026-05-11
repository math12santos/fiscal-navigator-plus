
-- =========================================================================
-- 1) NOVOS CAMPOS DE EMISSÃO DE PAGAMENTO
-- =========================================================================
ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS data_pagamento_emitido date,
  ADD COLUMN IF NOT EXISTS pagamento_emitido_por uuid,
  ADD COLUMN IF NOT EXISTS pagamento_emitido_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_meio text;

-- =========================================================================
-- 2) MIGRAÇÃO DE DADOS LEGADOS
-- Lançamentos status='pago'/'recebido' SEM vínculo a extrato → reclassifica
-- =========================================================================
WITH linked AS (
  SELECT DISTINCT cashflow_entry_id
  FROM public.bank_statement_entries
  WHERE cashflow_entry_id IS NOT NULL
)
UPDATE public.cashflow_entries c
SET status = CASE
      WHEN c.status = 'pago' THEN 'pagamento_emitido'
      WHEN c.status = 'recebido' THEN 'recebimento_esperado'
      ELSE c.status
    END,
    data_pagamento_emitido = COALESCE(c.data_pagamento_emitido, c.data_realizada, c.data_prevista)
WHERE c.status IN ('pago', 'recebido')
  AND COALESCE(c.source, '') <> 'import_historico'
  AND c.id NOT IN (SELECT cashflow_entry_id FROM linked);

-- =========================================================================
-- 3) TRIGGER GUARD: só conciliação promove para pago/recebido
-- Conciliação define current_setting('app.allow_realize') = 'on'.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cashflow_realize_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allow_flag text;
  is_linked boolean;
BEGIN
  -- transição PARA pago/recebido
  IF NEW.status IN ('pago', 'recebido')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN

    BEGIN
      allow_flag := current_setting('app.allow_realize', true);
    EXCEPTION WHEN OTHERS THEN
      allow_flag := NULL;
    END;

    IF allow_flag = 'on' THEN
      RETURN NEW; -- veio do fluxo de conciliação
    END IF;

    -- Importação histórica liberada
    IF COALESCE(NEW.source, '') = 'import_historico' THEN
      RETURN NEW;
    END IF;

    -- Já existe vínculo ao extrato?
    SELECT EXISTS (
      SELECT 1 FROM public.bank_statement_entries
      WHERE cashflow_entry_id = NEW.id
    ) INTO is_linked;

    IF is_linked THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'MECE: lançamento só pode ser marcado como % via conciliação bancária. Use status=% para registrar pagamento emitido.',
      NEW.status,
      CASE WHEN NEW.status = 'pago' THEN 'pagamento_emitido' ELSE 'recebimento_esperado' END;
  END IF;

  -- Bloqueia escrita em valor_realizado/data_realizada fora do fluxo de conciliação
  IF TG_OP = 'UPDATE'
     AND (NEW.valor_realizado IS DISTINCT FROM OLD.valor_realizado
          OR NEW.data_realizada IS DISTINCT FROM OLD.data_realizada) THEN
    BEGIN
      allow_flag := current_setting('app.allow_realize', true);
    EXCEPTION WHEN OTHERS THEN
      allow_flag := NULL;
    END;
    IF allow_flag <> 'on' AND COALESCE(NEW.source, '') <> 'import_historico' THEN
      -- Permite limpar (ex.: desfazer emissão) só se não houver vínculo
      IF NEW.valor_realizado IS NOT NULL OR NEW.data_realizada IS NOT NULL THEN
        RAISE EXCEPTION
          'MECE: valor_realizado/data_realizada só podem ser preenchidos via conciliação bancária.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashflow_realize_guard ON public.cashflow_entries;
CREATE TRIGGER trg_cashflow_realize_guard
  BEFORE INSERT OR UPDATE ON public.cashflow_entries
  FOR EACH ROW EXECUTE FUNCTION public.cashflow_realize_guard();

-- =========================================================================
-- 4) RPC register_payment_issued — botão "Registrar pagamento emitido"
-- =========================================================================
CREATE OR REPLACE FUNCTION public.register_payment_issued(
  p_entry_id uuid,
  p_data_emissao date DEFAULT NULL,
  p_meio text DEFAULT NULL
) RETURNS public.cashflow_entries
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  rec public.cashflow_entries;
  new_status text;
BEGIN
  SELECT * INTO rec FROM public.cashflow_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado'; END IF;

  IF rec.status IN ('pago','recebido') THEN
    RAISE EXCEPTION 'Lançamento já está realizado (conciliado)';
  END IF;

  new_status := CASE WHEN rec.tipo = 'entrada' THEN 'recebimento_esperado' ELSE 'pagamento_emitido' END;

  UPDATE public.cashflow_entries SET
    status = new_status,
    data_pagamento_emitido = COALESCE(p_data_emissao, CURRENT_DATE),
    pagamento_emitido_em = now(),
    pagamento_emitido_por = auth.uid(),
    pagamento_meio = COALESCE(p_meio, pagamento_meio),
    updated_at = now()
  WHERE id = p_entry_id
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_payment_issued(p_entry_id uuid)
RETURNS public.cashflow_entries
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE rec public.cashflow_entries;
BEGIN
  SELECT * INTO rec FROM public.cashflow_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado'; END IF;
  IF rec.status NOT IN ('pagamento_emitido','recebimento_esperado') THEN
    RAISE EXCEPTION 'Lançamento não está em estado de pagamento emitido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bank_statement_entries WHERE cashflow_entry_id = p_entry_id) THEN
    RAISE EXCEPTION 'Lançamento já vinculado ao extrato — desfaça a conciliação primeiro';
  END IF;
  UPDATE public.cashflow_entries SET
    status = 'previsto',
    data_pagamento_emitido = NULL,
    pagamento_emitido_em = NULL,
    pagamento_emitido_por = NULL,
    pagamento_meio = NULL,
    updated_at = now()
  WHERE id = p_entry_id RETURNING * INTO rec;
  RETURN rec;
END;
$$;

-- =========================================================================
-- 5) Patch reconcile/unreconcile para liberar a flag de sessão
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reconcile_statement_entry(
  p_statement_id uuid,
  p_cashflow_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  s record;
  c record;
  new_status text;
BEGIN
  PERFORM set_config('app.allow_realize', 'on', true);

  SELECT * INTO s FROM public.bank_statement_entries WHERE id = p_statement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha de extrato não encontrada'; END IF;

  SELECT * INTO c FROM public.cashflow_entries WHERE id = p_cashflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado'; END IF;

  new_status := CASE WHEN c.tipo = 'entrada' THEN 'recebido' ELSE 'pago' END;

  UPDATE public.cashflow_entries SET
    status = new_status,
    valor_realizado = ABS(s.valor),
    data_realizada = s.data,
    updated_at = now()
  WHERE id = p_cashflow_id;

  UPDATE public.bank_statement_entries SET
    status = 'conciliado',
    cashflow_entry_id = p_cashflow_id,
    reconciled_at = now(),
    reconciled_by = auth.uid(),
    updated_at = now()
  WHERE id = p_statement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unreconcile_statement_entry(
  p_statement_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  s record;
  c record;
  revert_status text;
BEGIN
  PERFORM set_config('app.allow_realize', 'on', true);

  SELECT * INTO s FROM public.bank_statement_entries WHERE id = p_statement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha de extrato não encontrada'; END IF;

  IF s.cashflow_entry_id IS NOT NULL THEN
    SELECT * INTO c FROM public.cashflow_entries WHERE id = s.cashflow_entry_id FOR UPDATE;
    IF FOUND THEN
      revert_status := CASE
        WHEN c.data_pagamento_emitido IS NOT NULL THEN
          CASE WHEN c.tipo = 'entrada' THEN 'recebimento_esperado' ELSE 'pagamento_emitido' END
        ELSE 'previsto'
      END;
      UPDATE public.cashflow_entries SET
        status = revert_status,
        valor_realizado = NULL,
        data_realizada = NULL,
        updated_at = now()
      WHERE id = s.cashflow_entry_id;
    END IF;
  END IF;

  UPDATE public.bank_statement_entries SET
    status = 'pendente',
    cashflow_entry_id = NULL,
    reconciled_at = NULL,
    reconciled_by = NULL,
    updated_at = now()
  WHERE id = p_statement_id;
END;
$$;

-- =========================================================================
-- 6) RPCs de fechamento de mês
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_month_closing_readiness(
  p_org_id uuid,
  p_year_month text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  start_d date := to_date(p_year_month || '-01', 'YYYY-MM-DD');
  end_d date := (start_d + interval '1 month - 1 day')::date;
  ext_total int;
  ext_pendente int;
  staging_pendente int;
  ap_total int; ap_realizado int;
  ar_total int; ar_realizado int;
  pct_ext numeric; pct_ap numeric; pct_ar numeric;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'pendente')
    INTO ext_total, ext_pendente
  FROM public.bank_statement_entries
  WHERE organization_id = p_org_id AND data BETWEEN start_d AND end_d;

  SELECT count(*) INTO staging_pendente
  FROM public.bank_statement_staging
  WHERE organization_id = p_org_id AND status = 'pendente';

  SELECT
    count(*) FILTER (WHERE tipo = 'saida' AND impacto_fluxo_caixa IS NOT FALSE),
    count(*) FILTER (WHERE tipo = 'saida' AND impacto_fluxo_caixa IS NOT FALSE
                          AND status IN ('pago','recebido')),
    count(*) FILTER (WHERE tipo = 'entrada' AND impacto_fluxo_caixa IS NOT FALSE),
    count(*) FILTER (WHERE tipo = 'entrada' AND impacto_fluxo_caixa IS NOT FALSE
                          AND status IN ('pago','recebido'))
    INTO ap_total, ap_realizado, ar_total, ar_realizado
  FROM public.cashflow_entries
  WHERE organization_id = p_org_id
    AND COALESCE(data_vencimento, data_prevista) BETWEEN start_d AND end_d
    AND status <> 'cancelado';

  pct_ext := CASE WHEN ext_total > 0 THEN (ext_total - ext_pendente)::numeric / ext_total ELSE 1 END;
  pct_ap  := CASE WHEN ap_total > 0  THEN ap_realizado::numeric / ap_total  ELSE 1 END;
  pct_ar  := CASE WHEN ar_total > 0  THEN ar_realizado::numeric / ar_total  ELSE 1 END;

  RETURN jsonb_build_object(
    'year_month', p_year_month,
    'extrato_total', ext_total,
    'extrato_pendente', ext_pendente,
    'staging_pendente', staging_pendente,
    'ap_total', ap_total,
    'ap_realizado', ap_realizado,
    'ar_total', ar_total,
    'ar_realizado', ar_realizado,
    'pct_extrato', round(pct_ext * 100, 1),
    'pct_ap', round(pct_ap * 100, 1),
    'pct_ar', round(pct_ar * 100, 1),
    'pct_geral', round(((pct_ext + pct_ap + pct_ar) / 3) * 100, 1),
    'ready', (ext_pendente = 0 AND staging_pendente = 0
              AND ap_total = ap_realizado AND ar_total = ar_realizado)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_fiscal_period(
  p_org_id uuid,
  p_year_month text
) RETURNS public.fiscal_periods
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  rd jsonb;
  rec public.fiscal_periods;
BEGIN
  rd := public.get_month_closing_readiness(p_org_id, p_year_month);
  IF NOT (rd->>'ready')::boolean THEN
    RAISE EXCEPTION 'Mês % não está pronto para fechamento. Pendências: %', p_year_month, rd::text;
  END IF;

  INSERT INTO public.fiscal_periods (organization_id, year_month, status, closed_at, closed_by)
  VALUES (p_org_id, p_year_month, 'fechado', now(), auth.uid())
  ON CONFLICT (organization_id, year_month) DO UPDATE
    SET status = 'fechado', closed_at = now(), closed_by = auth.uid(),
        reopened_at = NULL, reopened_by = NULL
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;
