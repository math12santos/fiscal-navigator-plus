
-- ============================================================
-- COMPRAS - FASE 2: Cotações + Recebimentos + Divergências
-- ============================================================

-- ===== QUOTATIONS =====
CREATE TABLE public.purchase_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  codigo TEXT,
  status TEXT NOT NULL DEFAULT 'em_analise',
  -- em_analise | recebida | escolhida | descartada | expirada
  valor_total NUMERIC(14,2) DEFAULT 0,
  prazo_entrega_dias INT,
  validade_proposta DATE,
  condicao_pagamento TEXT,
  frete NUMERIC(14,2) DEFAULT 0,
  desconto NUMERIC(14,2) DEFAULT 0,
  observacao TEXT,
  anexo_path TEXT,
  recebida_em TIMESTAMPTZ DEFAULT now(),
  decided_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  request_item_id UUID REFERENCES public.purchase_request_items(id) ON DELETE SET NULL,
  ordem INT NOT NULL DEFAULT 1,
  nome TEXT NOT NULL,
  quantidade NUMERIC(14,4) NOT NULL DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pq_org ON public.purchase_quotations(organization_id);
CREATE INDEX idx_pq_request ON public.purchase_quotations(request_id);
CREATE INDEX idx_pqi_quot ON public.purchase_quotation_items(quotation_id);

ALTER TABLE public.purchase_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read pq" ON public.purchase_quotations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org members write pq" ON public.purchase_quotations FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org members read pqi" ON public.purchase_quotation_items FOR SELECT
  USING (quotation_id IN (SELECT id FROM public.purchase_quotations WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())));
CREATE POLICY "org members write pqi" ON public.purchase_quotation_items FOR ALL
  USING (quotation_id IN (SELECT id FROM public.purchase_quotations WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())))
  WITH CHECK (quotation_id IN (SELECT id FROM public.purchase_quotations WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())));

CREATE TRIGGER trg_pq_updated_at BEFORE UPDATE ON public.purchase_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequencial COT-AAAA-NNNN
CREATE OR REPLACE FUNCTION public.fn_pq_assign_codigo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_seq INT;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    SELECT COALESCE(MAX(CAST(split_part(codigo, '-', 3) AS INT)), 0) + 1 INTO v_seq
    FROM public.purchase_quotations
    WHERE organization_id = NEW.organization_id AND codigo LIKE 'COT-' || v_year || '-%';
    NEW.codigo := 'COT-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pq_codigo BEFORE INSERT ON public.purchase_quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_pq_assign_codigo();

-- Quando uma cotação é "escolhida", marca outras da mesma request como "descartada"
CREATE OR REPLACE FUNCTION public.fn_pq_after_choose()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'escolhida' AND (OLD.status IS DISTINCT FROM 'escolhida') THEN
    UPDATE public.purchase_quotations
       SET status = 'descartada', decided_at = now()
     WHERE request_id = NEW.request_id
       AND id <> NEW.id
       AND status NOT IN ('escolhida', 'descartada');
    UPDATE public.purchase_requests
       SET status = 'em_cotacao'
     WHERE id = NEW.request_id AND status NOT IN ('pedido_gerado', 'concluida', 'cancelada');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pq_after_choose AFTER UPDATE ON public.purchase_quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_pq_after_choose();

-- ===== RECEIPTS =====
CREATE TABLE public.purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  codigo TEXT,
  data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_nf TEXT,
  serie_nf TEXT,
  data_emissao_nf DATE,
  recebido_por UUID,
  status TEXT NOT NULL DEFAULT 'parcial',
  -- parcial | total | divergente | rejeitado
  observacao TEXT,
  anexo_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  ordem INT NOT NULL DEFAULT 1,
  nome TEXT NOT NULL,
  quantidade_pedida NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantidade_recebida NUMERIC(14,4) NOT NULL DEFAULT 0,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status_item TEXT NOT NULL DEFAULT 'ok',
  -- ok | parcial | divergente | rejeitado
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_org ON public.purchase_receipts(organization_id);
CREATE INDEX idx_pr_order ON public.purchase_receipts(order_id);
CREATE INDEX idx_pri_receipt ON public.purchase_receipt_items(receipt_id);

ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read pr" ON public.purchase_receipts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org members write pr" ON public.purchase_receipts FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org members read pri" ON public.purchase_receipt_items FOR SELECT
  USING (receipt_id IN (SELECT id FROM public.purchase_receipts WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())));
CREATE POLICY "org members write pri" ON public.purchase_receipt_items FOR ALL
  USING (receipt_id IN (SELECT id FROM public.purchase_receipts WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())))
  WITH CHECK (receipt_id IN (SELECT id FROM public.purchase_receipts WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())));

CREATE TRIGGER trg_pr_updated_at BEFORE UPDATE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequencial REC-AAAA-NNNN
CREATE OR REPLACE FUNCTION public.fn_pr_assign_codigo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_seq INT;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    SELECT COALESCE(MAX(CAST(split_part(codigo, '-', 3) AS INT)), 0) + 1 INTO v_seq
    FROM public.purchase_receipts
    WHERE organization_id = NEW.organization_id AND codigo LIKE 'REC-' || v_year || '-%';
    NEW.codigo := 'REC-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pr_codigo BEFORE INSERT ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_pr_assign_codigo();

-- ===== DIVERGENCES =====
CREATE TABLE public.purchase_divergences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  receipt_id UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  receipt_item_id UUID REFERENCES public.purchase_receipt_items(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  -- quantidade | preco | qualidade | atraso | item_errado | nf_divergente | outro
  severidade TEXT NOT NULL DEFAULT 'media', -- baixa | media | alta
  status TEXT NOT NULL DEFAULT 'aberta', -- aberta | em_negociacao | resolvida | escalada
  descricao TEXT NOT NULL,
  acao_corretiva TEXT,
  resolvida_em TIMESTAMPTZ,
  resolvida_por UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pd_org ON public.purchase_divergences(organization_id);
CREATE INDEX idx_pd_receipt ON public.purchase_divergences(receipt_id);

ALTER TABLE public.purchase_divergences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read pd" ON public.purchase_divergences FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org members write pd" ON public.purchase_divergences FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE TRIGGER trg_pd_updated_at BEFORE UPDATE ON public.purchase_divergences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== TRIGGER: atualiza status do pedido quando recebimentos mudam =====
CREATE OR REPLACE FUNCTION public.fn_pr_after_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID := COALESCE(NEW.order_id, OLD.order_id);
  v_total_pedido NUMERIC := 0;
  v_total_recebido NUMERIC := 0;
  v_has_divergente BOOLEAN := FALSE;
BEGIN
  -- soma quantidades pedidas no pedido
  SELECT COALESCE(SUM(quantidade), 0) INTO v_total_pedido
  FROM public.purchase_order_items WHERE order_id = v_order_id;

  -- soma quantidades recebidas em todos os recebimentos do pedido
  SELECT COALESCE(SUM(pri.quantidade_recebida), 0) INTO v_total_recebido
  FROM public.purchase_receipts pr
  JOIN public.purchase_receipt_items pri ON pri.receipt_id = pr.id
  WHERE pr.order_id = v_order_id AND pr.status <> 'rejeitado';

  -- existe alguma divergência aberta?
  SELECT EXISTS(
    SELECT 1 FROM public.purchase_divergences
    WHERE order_id = v_order_id AND status IN ('aberta', 'em_negociacao')
  ) INTO v_has_divergente;

  IF v_has_divergente THEN
    UPDATE public.purchase_orders SET status = 'parcialmente_recebido' WHERE id = v_order_id AND status NOT IN ('cancelado', 'concluido');
  ELSIF v_total_recebido >= v_total_pedido AND v_total_pedido > 0 THEN
    UPDATE public.purchase_orders SET status = 'recebido' WHERE id = v_order_id AND status NOT IN ('cancelado', 'concluido');
  ELSIF v_total_recebido > 0 THEN
    UPDATE public.purchase_orders SET status = 'parcialmente_recebido' WHERE id = v_order_id AND status NOT IN ('cancelado', 'concluido');
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_pr_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_pr_after_change();

-- ===== AUDIT =====
CREATE OR REPLACE FUNCTION public.fn_pq_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.purchase_audit_log (organization_id, entidade, entidade_id, acao, payload, user_id)
  VALUES (NEW.organization_id, 'quotation', NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pq_audit AFTER INSERT OR UPDATE ON public.purchase_quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_pq_audit();

CREATE OR REPLACE FUNCTION public.fn_pr_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.purchase_audit_log (organization_id, entidade, entidade_id, acao, payload, user_id)
  VALUES (NEW.organization_id, 'receipt', NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pr_audit AFTER INSERT OR UPDATE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_pr_audit();
