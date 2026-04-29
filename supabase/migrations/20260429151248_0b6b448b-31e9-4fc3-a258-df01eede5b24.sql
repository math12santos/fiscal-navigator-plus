-- ============================================================
-- Bank Statement Entries (linhas de extrato bancário importado)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_statement_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(18,2) NOT NULL,
  documento TEXT,
  notes TEXT,
  import_id UUID REFERENCES public.data_imports(id) ON DELETE SET NULL,
  source_ref TEXT,
  cashflow_entry_id UUID REFERENCES public.cashflow_entries(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','conciliado','divergente','ignorado')),
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Idempotência: mesmo padrão de cashflow_entries
CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_org_account_source_uq
  ON public.bank_statement_entries (organization_id, bank_account_id, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS bank_statement_org_data_idx
  ON public.bank_statement_entries (organization_id, data DESC);

CREATE INDEX IF NOT EXISTS bank_statement_account_status_idx
  ON public.bank_statement_entries (bank_account_id, status);

CREATE INDEX IF NOT EXISTS bank_statement_cashflow_idx
  ON public.bank_statement_entries (cashflow_entry_id) WHERE cashflow_entry_id IS NOT NULL;

-- ────────────── RLS ──────────────
ALTER TABLE public.bank_statement_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statement_select" ON public.bank_statement_entries
  FOR SELECT USING (
    is_org_member(auth.uid(), organization_id)
    OR has_backoffice_org_access(organization_id)
  );

CREATE POLICY "bank_statement_insert" ON public.bank_statement_entries
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
  );

CREATE POLICY "bank_statement_update" ON public.bank_statement_entries
  FOR UPDATE USING (
    is_org_member(auth.uid(), organization_id)
    OR has_backoffice_org_access(organization_id)
  );

CREATE POLICY "bank_statement_delete" ON public.bank_statement_entries
  FOR DELETE USING (
    is_org_member(auth.uid(), organization_id)
    OR has_backoffice_org_access(organization_id)
  );

-- ────────────── Trigger updated_at ──────────────
CREATE TRIGGER trg_bank_statement_updated_at
  BEFORE UPDATE ON public.bank_statement_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ────────────── RPC: sugere candidatos de cashflow para uma linha de extrato ──────────────
CREATE OR REPLACE FUNCTION public.match_statement_to_cashflow(p_statement_id UUID)
RETURNS TABLE (
  cashflow_id UUID,
  descricao TEXT,
  valor_previsto NUMERIC,
  valor_realizado NUMERIC,
  data_prevista DATE,
  data_realizada DATE,
  tipo TEXT,
  status TEXT,
  score NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_account UUID;
  v_data DATE;
  v_valor NUMERIC;
BEGIN
  SELECT organization_id, bank_account_id, data, valor
    INTO v_org, v_account, v_data, v_valor
  FROM public.bank_statement_entries
  WHERE id = p_statement_id;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  -- Permissão: precisa ser membro da org ou backoffice
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
    -- Score 0..1: 70% peso valor, 30% peso data
    (
      0.7 * (1 - LEAST(1, ABS(ABS(ce.valor_previsto) - ABS(v_valor)) / GREATEST(ABS(v_valor), 1)))
      + 0.3 * (1 - LEAST(1, ABS(EXTRACT(EPOCH FROM (COALESCE(ce.data_realizada, ce.data_prevista) - v_data)) / 86400) / 7))
    )::NUMERIC AS score
  FROM public.cashflow_entries ce
  WHERE ce.organization_id = v_org
    AND (ce.conta_bancaria_id = v_account OR ce.conta_bancaria_id IS NULL)
    AND ce.conciliacao_id IS NULL
    AND ce.id NOT IN (
      SELECT cashflow_entry_id FROM public.bank_statement_entries
      WHERE cashflow_entry_id IS NOT NULL AND status = 'conciliado'
    )
    -- valor dentro de ±10% e data dentro de ±7 dias (filtro grosso, score afina)
    AND ABS(ABS(ce.valor_previsto) - ABS(v_valor)) <= GREATEST(ABS(v_valor) * 0.10, 1)
    AND ABS(EXTRACT(EPOCH FROM (COALESCE(ce.data_realizada, ce.data_prevista) - v_data)) / 86400) <= 7
  ORDER BY score DESC
  LIMIT 5;
END;
$$;

-- ────────────── RPC: conciliar (vincular extrato ↔ cashflow) ──────────────
CREATE OR REPLACE FUNCTION public.reconcile_statement_entry(
  p_statement_id UUID,
  p_cashflow_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_data DATE;
  v_valor NUMERIC;
  v_account UUID;
BEGIN
  SELECT organization_id, data, valor, bank_account_id
    INTO v_org, v_data, v_valor, v_account
  FROM public.bank_statement_entries
  WHERE id = p_statement_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Linha de extrato não encontrada';
  END IF;

  IF NOT (is_org_member(auth.uid(), v_org) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  -- Atualiza extrato
  UPDATE public.bank_statement_entries
    SET cashflow_entry_id = p_cashflow_id,
        status = 'conciliado',
        reconciled_at = now(),
        reconciled_by = auth.uid()
    WHERE id = p_statement_id;

  -- Atualiza cashflow: marca como pago/realizado e vincula conta bancária
  UPDATE public.cashflow_entries
    SET conciliacao_id = p_statement_id,
        conta_bancaria_id = COALESCE(conta_bancaria_id, v_account),
        valor_realizado = COALESCE(valor_realizado, ABS(v_valor)),
        data_realizada = COALESCE(data_realizada, v_data),
        status = CASE WHEN status::text IN ('pago','recebido') THEN status ELSE 'pago'::cashflow_status END
    WHERE id = p_cashflow_id;
END;
$$;

-- ────────────── RPC: desfazer conciliação ──────────────
CREATE OR REPLACE FUNCTION public.unreconcile_statement_entry(p_statement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_cashflow UUID;
BEGIN
  SELECT organization_id, cashflow_entry_id
    INTO v_org, v_cashflow
  FROM public.bank_statement_entries
  WHERE id = p_statement_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Linha de extrato não encontrada';
  END IF;

  IF NOT (is_org_member(auth.uid(), v_org) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  UPDATE public.bank_statement_entries
    SET cashflow_entry_id = NULL,
        status = 'pendente',
        reconciled_at = NULL,
        reconciled_by = NULL
    WHERE id = p_statement_id;

  IF v_cashflow IS NOT NULL THEN
    UPDATE public.cashflow_entries
      SET conciliacao_id = NULL
      WHERE id = v_cashflow;
  END IF;
END;
$$;