-- Extensão para similaridade textual
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1) reconciliation_rules: regras persistidas de classificação
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description_pattern TEXT NOT NULL,         -- regex ou substring (case-insensitive)
  match_mode TEXT NOT NULL DEFAULT 'contains', -- 'contains' | 'regex' | 'exact'
  tipo TEXT,                                  -- 'pagar' | 'receber' (opcional)
  account_id UUID,                            -- conta contábil destino
  cost_center_id UUID,                        -- centro de custo destino
  entity_id UUID,                             -- favorecido/cliente padrão
  conta_bancaria_id UUID,                     -- conta bancária padrão
  min_value NUMERIC(14,2),                    -- valor mínimo (opcional)
  max_value NUMERIC(14,2),                    -- valor máximo (opcional)
  priority INT NOT NULL DEFAULT 100,          -- menor = aplica antes
  active BOOLEAN NOT NULL DEFAULT true,
  hits INT NOT NULL DEFAULT 0,                -- contador de aplicações
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_org_active
  ON public.reconciliation_rules (organization_id, active, priority);

ALTER TABLE public.reconciliation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules_select_member"
  ON public.reconciliation_rules FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "rules_insert_member"
  ON public.reconciliation_rules FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = user_id);

CREATE POLICY "rules_update_member"
  ON public.reconciliation_rules FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "rules_delete_member"
  ON public.reconciliation_rules FOR DELETE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_reconciliation_rules_updated_at
  BEFORE UPDATE ON public.reconciliation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) bank_balance_snapshots: saldo diário por conta
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  bank_account_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  saldo NUMERIC(14,2) NOT NULL,
  saldo_conciliado NUMERIC(14,2),       -- soma de cashflow conciliados até a data
  saldo_previsto NUMERIC(14,2),         -- saldo + previstos pendentes
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'cron' | 'webhook'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_bank_snapshots_org_date
  ON public.bank_balance_snapshots (organization_id, snapshot_date DESC);

ALTER TABLE public.bank_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_select_member"
  ON public.bank_balance_snapshots FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "snapshots_insert_member"
  ON public.bank_balance_snapshots FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "snapshots_update_member"
  ON public.bank_balance_snapshots FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "snapshots_delete_member"
  ON public.bank_balance_snapshots FOR DELETE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- ============================================================
-- 3) RPC v2: match com similaridade textual
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_statement_to_cashflow_v2(p_statement_id UUID)
RETURNS TABLE(
  cashflow_id UUID,
  descricao TEXT,
  valor_previsto NUMERIC,
  valor_realizado NUMERIC,
  data_prevista DATE,
  data_realizada DATE,
  tipo TEXT,
  status TEXT,
  score NUMERIC,
  score_valor NUMERIC,
  score_data NUMERIC,
  score_texto NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID;
  v_account UUID;
  v_data DATE;
  v_valor NUMERIC;
  v_descricao TEXT;
BEGIN
  SELECT organization_id, bank_account_id, data, valor, descricao
    INTO v_org, v_account, v_data, v_valor, v_descricao
  FROM public.bank_statement_entries
  WHERE id = p_statement_id;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  IF NOT (is_org_member(auth.uid(), v_org) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  RETURN QUERY
  SELECT
    ce.id,
    ce.descricao,
    ce.valor_previsto,
    ce.valor_realizado,
    ce.data_prevista,
    ce.data_realizada,
    ce.tipo::text,
    ce.status::text,
    -- Score final: 50% valor, 30% data, 20% texto
    (
      0.5 * (1 - LEAST(1, ABS(ABS(COALESCE(ce.valor_realizado, ce.valor_previsto)) - ABS(v_valor)) / GREATEST(ABS(v_valor), 1)))
      + 0.3 * (1 - LEAST(1, ABS(EXTRACT(EPOCH FROM (COALESCE(ce.data_realizada, ce.data_prevista) - v_data)) / 86400) / 7))
      + 0.2 * COALESCE(similarity(lower(ce.descricao), lower(COALESCE(v_descricao, ''))), 0)
    )::NUMERIC AS score,
    (1 - LEAST(1, ABS(ABS(COALESCE(ce.valor_realizado, ce.valor_previsto)) - ABS(v_valor)) / GREATEST(ABS(v_valor), 1)))::NUMERIC,
    (1 - LEAST(1, ABS(EXTRACT(EPOCH FROM (COALESCE(ce.data_realizada, ce.data_prevista) - v_data)) / 86400) / 7))::NUMERIC,
    COALESCE(similarity(lower(ce.descricao), lower(COALESCE(v_descricao, ''))), 0)::NUMERIC
  FROM public.cashflow_entries ce
  WHERE ce.organization_id = v_org
    AND (ce.conta_bancaria_id = v_account OR ce.conta_bancaria_id IS NULL)
    AND ce.conciliacao_id IS NULL
    AND ABS(ABS(COALESCE(ce.valor_realizado, ce.valor_previsto)) - ABS(v_valor)) <= GREATEST(ABS(v_valor) * 0.10, 1)
    AND ABS(EXTRACT(EPOCH FROM (COALESCE(ce.data_realizada, ce.data_prevista) - v_data)) / 86400) <= 7
  ORDER BY score DESC
  LIMIT 5;
END;
$$;

-- ============================================================
-- 4) Auto-match em lote (score ≥ 0.95)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_reconcile_statement_batch(
  p_org_id UUID,
  p_min_score NUMERIC DEFAULT 0.95,
  p_limit INT DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stmt RECORD;
  v_match RECORD;
  v_processed INT := 0;
  v_matched INT := 0;
  v_skipped INT := 0;
BEGIN
  IF NOT (is_org_member(auth.uid(), p_org_id) OR has_backoffice_org_access(p_org_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  FOR v_stmt IN
    SELECT id FROM public.bank_statement_entries
    WHERE organization_id = p_org_id
      AND status = 'pendente'
      AND cashflow_entry_id IS NULL
    ORDER BY data DESC
    LIMIT p_limit
  LOOP
    v_processed := v_processed + 1;

    SELECT * INTO v_match
    FROM public.match_statement_to_cashflow_v2(v_stmt.id)
    ORDER BY score DESC
    LIMIT 1;

    IF v_match.cashflow_id IS NOT NULL AND v_match.score >= p_min_score THEN
      PERFORM public.reconcile_statement_entry(v_stmt.id, v_match.cashflow_id);
      v_matched := v_matched + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'matched', v_matched,
    'skipped', v_skipped,
    'min_score', p_min_score
  );
END;
$$;

-- ============================================================
-- 5) Snapshot diário de saldos
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_bank_balances_daily(
  p_org_id UUID,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account RECORD;
  v_count INT := 0;
  v_saldo_concil NUMERIC;
  v_saldo_prev NUMERIC;
BEGIN
  IF NOT (is_org_member(auth.uid(), p_org_id) OR has_backoffice_org_access(p_org_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  FOR v_account IN
    SELECT id, saldo_atual FROM public.contas_bancarias
    WHERE organization_id = p_org_id AND ativo = true
  LOOP
    -- saldo conciliado: soma dos cashflow já realizados até a data
    SELECT COALESCE(SUM(
      CASE WHEN ce.tipo = 'receber' THEN COALESCE(ce.valor_realizado,0)
           ELSE -COALESCE(ce.valor_realizado,0) END
    ), 0) INTO v_saldo_concil
    FROM public.cashflow_entries ce
    WHERE ce.organization_id = p_org_id
      AND ce.conta_bancaria_id = v_account.id
      AND ce.status::text IN ('pago','recebido')
      AND COALESCE(ce.data_realizada, ce.data_prevista) <= p_snapshot_date;

    -- saldo previsto: + pendentes até a data
    SELECT v_saldo_concil + COALESCE(SUM(
      CASE WHEN ce.tipo = 'receber' THEN COALESCE(ce.valor_previsto,0)
           ELSE -COALESCE(ce.valor_previsto,0) END
    ), 0) INTO v_saldo_prev
    FROM public.cashflow_entries ce
    WHERE ce.organization_id = p_org_id
      AND ce.conta_bancaria_id = v_account.id
      AND ce.status::text IN ('previsto','confirmado')
      AND ce.data_prevista <= p_snapshot_date;

    INSERT INTO public.bank_balance_snapshots
      (organization_id, bank_account_id, snapshot_date, saldo, saldo_conciliado, saldo_previsto, source)
    VALUES
      (p_org_id, v_account.id, p_snapshot_date, COALESCE(v_account.saldo_atual,0), v_saldo_concil, v_saldo_prev, 'manual')
    ON CONFLICT (bank_account_id, snapshot_date) DO UPDATE
      SET saldo = EXCLUDED.saldo,
          saldo_conciliado = EXCLUDED.saldo_conciliado,
          saldo_previsto = EXCLUDED.saldo_previsto,
          source = EXCLUDED.source;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('snapshots_created', v_count, 'snapshot_date', p_snapshot_date);
END;
$$;

-- ============================================================
-- 6) Aplicar regras de conciliação em lote
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_reconciliation_rules(
  p_org_id UUID,
  p_only_unclassified BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_updated INT;
  v_total INT := 0;
  v_rules_applied INT := 0;
  v_match BOOLEAN;
BEGIN
  IF NOT (is_org_member(auth.uid(), p_org_id) OR has_backoffice_org_access(p_org_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  FOR v_rule IN
    SELECT * FROM public.reconciliation_rules
    WHERE organization_id = p_org_id AND active = true
    ORDER BY priority ASC, created_at ASC
  LOOP
    UPDATE public.cashflow_entries ce
    SET account_id = COALESCE(ce.account_id, v_rule.account_id),
        cost_center_id = COALESCE(ce.cost_center_id, v_rule.cost_center_id),
        entity_id = COALESCE(ce.entity_id, v_rule.entity_id),
        conta_bancaria_id = COALESCE(ce.conta_bancaria_id, v_rule.conta_bancaria_id)
    WHERE ce.organization_id = p_org_id
      AND (NOT p_only_unclassified OR ce.account_id IS NULL OR ce.cost_center_id IS NULL)
      AND (v_rule.tipo IS NULL OR ce.tipo::text = v_rule.tipo)
      AND (v_rule.min_value IS NULL OR ABS(COALESCE(ce.valor_realizado, ce.valor_previsto)) >= v_rule.min_value)
      AND (v_rule.max_value IS NULL OR ABS(COALESCE(ce.valor_realizado, ce.valor_previsto)) <= v_rule.max_value)
      AND CASE v_rule.match_mode
        WHEN 'exact'    THEN lower(ce.descricao) = lower(v_rule.description_pattern)
        WHEN 'regex'    THEN ce.descricao ~* v_rule.description_pattern
        ELSE                  lower(ce.descricao) LIKE '%' || lower(v_rule.description_pattern) || '%'
      END;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      UPDATE public.reconciliation_rules
        SET hits = hits + v_updated, last_applied_at = now()
        WHERE id = v_rule.id;
      v_rules_applied := v_rules_applied + 1;
      v_total := v_total + v_updated;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'rules_applied', v_rules_applied,
    'entries_updated', v_total
  );
END;
$$;

-- Index gin para acelerar similarity em descricao
CREATE INDEX IF NOT EXISTS idx_cashflow_descricao_trgm
  ON public.cashflow_entries USING gin (descricao gin_trgm_ops);