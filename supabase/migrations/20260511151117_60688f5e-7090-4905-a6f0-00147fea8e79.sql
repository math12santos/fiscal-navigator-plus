
-- ============================================================
-- COMPRAS - ONDA A: Integridade financeira (MECE)
-- ============================================================

-- =====================================================================
-- 1. NF-e completa nos recebimentos
-- =====================================================================
ALTER TABLE public.purchase_receipts
  ADD COLUMN IF NOT EXISTS nf_chave TEXT,
  ADD COLUMN IF NOT EXISTS nf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS nf_valor NUMERIC(14,2);

CREATE INDEX IF NOT EXISTS idx_pr_nf_chave ON public.purchase_receipts(nf_chave);

-- =====================================================================
-- 2. Rateio multi-centro de custo + retenções nos pedidos
--    cost_center_allocations: [{cost_center_id, percentual}] soma=100
--    tax_retentions: {irrf, inss, iss, pis, cofins, csll, total}
-- =====================================================================
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS cost_center_allocations JSONB,
  ADD COLUMN IF NOT EXISTS tax_retentions JSONB;

ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS cost_center_allocations JSONB,
  ADD COLUMN IF NOT EXISTS tax_retentions JSONB;

-- Validação do rateio (soma = 100% quando preenchido)
CREATE OR REPLACE FUNCTION public.fn_po_validate_allocations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_sum NUMERIC := 0;
BEGIN
  IF NEW.cost_center_allocations IS NOT NULL
     AND jsonb_typeof(NEW.cost_center_allocations) = 'array'
     AND jsonb_array_length(NEW.cost_center_allocations) > 0 THEN
    SELECT COALESCE(SUM((elem->>'percentual')::NUMERIC), 0)
      INTO v_sum
      FROM jsonb_array_elements(NEW.cost_center_allocations) elem;
    IF ROUND(v_sum, 2) <> 100.00 THEN
      RAISE EXCEPTION 'Rateio de centros de custo deve somar 100%% (atual: %)', v_sum;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_po_validate_allocations ON public.purchase_orders;
CREATE TRIGGER trg_po_validate_allocations
  BEFORE INSERT OR UPDATE OF cost_center_allocations ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_po_validate_allocations();

-- =====================================================================
-- 3. Cálculo de retenções tributárias para tipo='servico'
--    Alíquotas padrão (podem ser sobrescritas em purchase_settings futuramente)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.compute_purchase_tax_retentions(
  _tipo TEXT,
  _valor NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_irrf NUMERIC := 0;
  v_inss NUMERIC := 0;
  v_iss  NUMERIC := 0;
  v_pis  NUMERIC := 0;
  v_cof  NUMERIC := 0;
  v_csll NUMERIC := 0;
BEGIN
  IF COALESCE(_valor, 0) <= 0 THEN
    RETURN jsonb_build_object('total', 0);
  END IF;
  IF _tipo IN ('servico', 'manutencao', 'obra') THEN
    v_irrf := ROUND(_valor * 0.015, 2);  -- IRRF 1,5%
    v_inss := ROUND(_valor * 0.11,  2);  -- INSS 11%
    v_iss  := ROUND(_valor * 0.05,  2);  -- ISS  5% (municipal típico)
    v_pis  := ROUND(_valor * 0.0065,2);  -- PIS  0,65%
    v_cof  := ROUND(_valor * 0.03,  2);  -- COFINS 3%
    v_csll := ROUND(_valor * 0.01,  2);  -- CSLL 1%
  END IF;
  RETURN jsonb_build_object(
    'irrf', v_irrf, 'inss', v_inss, 'iss', v_iss,
    'pis',  v_pis,  'cofins', v_cof, 'csll', v_csll,
    'total', v_irrf + v_inss + v_iss + v_pis + v_cof + v_csll,
    'liquido', _valor - (v_irrf + v_inss + v_iss + v_pis + v_cof + v_csll)
  );
END $$;

-- =====================================================================
-- 4. Validação de chave NF-e (44 dígitos, módulo 11)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validate_nfe_chave(_chave TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_clean TEXT;
  v_base  TEXT;
  v_dv    INT;
  v_calc  INT := 0;
  v_peso  INT := 2;
  v_dig   INT;
  v_mod   INT;
  i INT;
BEGIN
  IF _chave IS NULL THEN RETURN FALSE; END IF;
  v_clean := regexp_replace(_chave, '\D', '', 'g');
  IF length(v_clean) <> 44 THEN RETURN FALSE; END IF;
  v_base := substring(v_clean FROM 1 FOR 43);
  v_dv   := substring(v_clean FROM 44 FOR 1)::INT;
  FOR i IN REVERSE 43..1 LOOP
    v_dig := substring(v_base FROM i FOR 1)::INT;
    v_calc := v_calc + v_dig * v_peso;
    v_peso := v_peso + 1;
    IF v_peso > 9 THEN v_peso := 2; END IF;
  END LOOP;
  v_mod := v_calc % 11;
  IF v_mod < 2 THEN
    RETURN v_dv = 0;
  ELSE
    RETURN v_dv = (11 - v_mod);
  END IF;
END $$;

-- =====================================================================
-- 5. Trigger NF-e: valida chave e gera divergências automáticas
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_pr_validate_nf()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_supplier_cnpj TEXT;
  v_order_total   NUMERIC;
  v_clean_nf_cnpj TEXT;
  v_clean_sup_cnpj TEXT;
BEGIN
  IF NEW.nf_chave IS NOT NULL AND NEW.nf_chave <> '' THEN
    IF NOT public.validate_nfe_chave(NEW.nf_chave) THEN
      INSERT INTO public.purchase_divergences
        (organization_id, receipt_id, order_id, tipo, severidade, status, descricao, created_by)
      VALUES
        (NEW.organization_id, NEW.id, NEW.order_id, 'nf_divergente', 'alta', 'aberta',
         'Chave NF-e inválida (DV módulo 11 não confere): ' || NEW.nf_chave,
         NEW.created_by);
    END IF;
  END IF;

  IF NEW.nf_cnpj IS NOT NULL AND NEW.nf_cnpj <> '' THEN
    SELECT s.cnpj INTO v_supplier_cnpj
      FROM public.purchase_orders po
      JOIN public.suppliers s ON s.id = po.supplier_id
     WHERE po.id = NEW.order_id;
    v_clean_nf_cnpj  := regexp_replace(NEW.nf_cnpj, '\D', '', 'g');
    v_clean_sup_cnpj := regexp_replace(COALESCE(v_supplier_cnpj, ''), '\D', '', 'g');
    IF v_clean_sup_cnpj <> '' AND v_clean_nf_cnpj <> v_clean_sup_cnpj THEN
      INSERT INTO public.purchase_divergences
        (organization_id, receipt_id, order_id, tipo, severidade, status, descricao, created_by)
      VALUES
        (NEW.organization_id, NEW.id, NEW.order_id, 'nf_divergente', 'alta', 'aberta',
         'CNPJ da NF (' || NEW.nf_cnpj || ') não confere com fornecedor (' || COALESCE(v_supplier_cnpj,'-') || ')',
         NEW.created_by);
    END IF;
  END IF;

  IF NEW.nf_valor IS NOT NULL AND NEW.nf_valor > 0 THEN
    SELECT po.valor_total INTO v_order_total
      FROM public.purchase_orders po WHERE po.id = NEW.order_id;
    IF v_order_total IS NOT NULL AND ABS(NEW.nf_valor - v_order_total) > 0.02 THEN
      INSERT INTO public.purchase_divergences
        (organization_id, receipt_id, order_id, tipo, severidade, status, descricao, created_by)
      VALUES
        (NEW.organization_id, NEW.id, NEW.order_id, 'preco', 'media', 'aberta',
         'Valor da NF (R$ ' || NEW.nf_valor || ') diverge do pedido (R$ ' || v_order_total || ')',
         NEW.created_by);
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pr_validate_nf ON public.purchase_receipts;
CREATE TRIGGER trg_pr_validate_nf
  AFTER INSERT OR UPDATE OF nf_chave, nf_cnpj, nf_valor ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_pr_validate_nf();

-- =====================================================================
-- 6. Materialização MECE: receipt total → cashflow realizado
--    Evita duplicidade quando PO está vinculado a contrato.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_pr_materialize_cashflow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po                public.purchase_orders%ROWTYPE;
  v_settings          RECORD;
  v_prazo_dias        INT := 0;
  v_data_pgto         DATE;
  v_valor             NUMERIC;
  v_retencoes         JSONB;
  v_competencia       TEXT;
BEGIN
  -- Apenas quando o recebimento fica "total"
  IF NEW.status <> 'total' OR (TG_OP = 'UPDATE' AND OLD.status = 'total') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Pedido vinculado a contrato: parcela do contrato já projeta no cashflow
  IF v_po.contract_id IS NOT NULL THEN
    -- Apenas remove o lançamento provisório do PO (se existir) para não duplicar
    DELETE FROM public.cashflow_entries
     WHERE source_ref = 'purchase_order:' || v_po.id::text
       AND status = 'previsto';
    RETURN NEW;
  END IF;

  -- Valor da NF tem precedência sobre valor do pedido
  v_valor := COALESCE(NEW.nf_valor, v_po.valor_total, 0);

  -- Vencimento: data_recebimento + prazo da condição de pagamento (extrai dígitos da string)
  IF v_po.condicao_pagamento ~ '\d+' THEN
    v_prazo_dias := COALESCE((regexp_match(v_po.condicao_pagamento, '(\d+)'))[1]::INT, 0);
  END IF;
  v_data_pgto := COALESCE(v_po.data_prevista_pagamento,
                          NEW.data_recebimento + (v_prazo_dias || ' days')::INTERVAL,
                          CURRENT_DATE);
  v_competencia := to_char(NEW.data_recebimento, 'YYYY-MM');

  -- Retenções (apenas serviços)
  v_retencoes := public.compute_purchase_tax_retentions(v_po.tipo_compra, v_valor);

  -- Atualiza o entry provisório (idempotente via source_ref)
  UPDATE public.cashflow_entries
     SET valor                   = v_valor,
         data_vencimento         = v_data_pgto,
         status                  = 'a_pagar',
         competencia             = v_competencia,
         documento               = COALESCE(NEW.numero_nf, documento),
         tax_retentions          = v_retencoes,
         cost_center_allocations = v_po.cost_center_allocations,
         updated_at              = now()
   WHERE source_ref = 'purchase_order:' || v_po.id::text;

  -- Se não existia, cria
  IF NOT FOUND THEN
    INSERT INTO public.cashflow_entries
      (organization_id, tipo, valor, data_vencimento, descricao, status,
       account_id, cost_center_id, contract_id, purchase_order_id,
       source, source_ref, competencia, documento,
       tax_retentions, cost_center_allocations)
    VALUES
      (v_po.organization_id, 'saida', v_valor, v_data_pgto,
       'Compra ' || COALESCE(v_po.codigo, '') || ' - NF ' || COALESCE(NEW.numero_nf, ''),
       'a_pagar', v_po.account_id, v_po.cost_center_id, v_po.contract_id,
       v_po.id, 'compras', 'purchase_order:' || v_po.id::text,
       v_competencia, NEW.numero_nf, v_retencoes, v_po.cost_center_allocations);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pr_materialize_cashflow ON public.purchase_receipts;
CREATE TRIGGER trg_pr_materialize_cashflow
  AFTER INSERT OR UPDATE OF status ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_pr_materialize_cashflow();

-- =====================================================================
-- 7. PO->cashflow provisional: pular se houver contract_id
-- =====================================================================
CREATE OR REPLACE FUNCTION public.purchase_order_to_cashflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_entity uuid;
BEGIN
  -- Pedido vinculado a contrato: não duplica projeção
  IF NEW.contract_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status IN ('emitido','enviado_ap'))
     OR (TG_OP = 'UPDATE' AND NEW.status = 'enviado_ap' AND COALESCE(OLD.status,'') <> 'enviado_ap') THEN

    SELECT s.entity_id INTO v_supplier_entity FROM public.suppliers s WHERE s.id = NEW.supplier_id;

    INSERT INTO public.cashflow_entries (
      organization_id, tipo, valor, data_vencimento, descricao, status,
      account_id, cost_center_id, entity_id, contract_id,
      purchase_order_id, source, source_ref,
      cost_center_allocations
    )
    SELECT
      NEW.organization_id, 'saida', NEW.valor_total,
      COALESCE(NEW.data_prevista_pagamento, NEW.data_emissao),
      'Pedido de Compra ' || COALESCE(NEW.codigo,''),
      'previsto',
      NEW.account_id, NEW.cost_center_id, v_supplier_entity, NEW.contract_id,
      NEW.id, 'compras', 'purchase_order:' || NEW.id::text,
      NEW.cost_center_allocations
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cashflow_entries ce
      WHERE ce.source_ref = 'purchase_order:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 8. Bloqueio por período fiscal fechado
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_po_check_fiscal_period()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_competencia TEXT;
  v_closed BOOLEAN;
BEGIN
  IF NEW.status IN ('confirmado', 'enviado_ap')
     AND COALESCE(OLD.status, '') NOT IN ('confirmado', 'enviado_ap') THEN
    v_competencia := to_char(COALESCE(NEW.data_prevista_pagamento, NEW.data_emissao, CURRENT_DATE), 'YYYY-MM');
    SELECT (status = 'closed') INTO v_closed
      FROM public.fiscal_periods
     WHERE organization_id = NEW.organization_id
       AND year_month = v_competencia
     LIMIT 1;
    IF COALESCE(v_closed, FALSE) THEN
      RAISE EXCEPTION 'Período fiscal % está fechado. Abra o período antes de confirmar o pedido.', v_competencia;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_po_check_fiscal_period ON public.purchase_orders;
CREATE TRIGGER trg_po_check_fiscal_period
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_po_check_fiscal_period();

-- =====================================================================
-- 9. Corrige nomes de colunas no log de auditoria (Phase 2 estava quebrada)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_pq_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.purchase_audit_log
    (organization_id, entity_type, entity_id, action, new_value)
  VALUES
    (NEW.organization_id, 'quotation', NEW.id, TG_OP, to_jsonb(NEW));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_pr_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.purchase_audit_log
    (organization_id, entity_type, entity_id, action, new_value)
  VALUES
    (NEW.organization_id, 'receipt', NEW.id, TG_OP, to_jsonb(NEW));
  RETURN NEW;
END $$;

-- =====================================================================
-- 10. Realtime + bump de versão (invalida dashboard snapshot)
-- =====================================================================
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_receipts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_divergences;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_quotations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.purchase_receipts    REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_divergences REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_quotations  REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bump_org_data_version') THEN
    BEGIN
      EXECUTE 'CREATE TRIGGER trg_prc_bump_version AFTER INSERT OR UPDATE OR DELETE ON public.purchase_receipts FOR EACH ROW EXECUTE FUNCTION public.bump_org_data_version()';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE 'CREATE TRIGGER trg_pdv_bump_version AFTER INSERT OR UPDATE OR DELETE ON public.purchase_divergences FOR EACH ROW EXECUTE FUNCTION public.bump_org_data_version()';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
