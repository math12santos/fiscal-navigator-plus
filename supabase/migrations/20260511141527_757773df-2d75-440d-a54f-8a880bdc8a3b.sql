
-- ============================================================================
-- COMPRAS — Fase 1 MVP
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SUPPLIERS
-- ----------------------------------------------------------------------------
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  documento text, -- CNPJ ou CPF
  inscricao_estadual text,
  inscricao_municipal text,
  tipo text NOT NULL DEFAULT 'pj', -- pj|pf|mei|estrangeiro
  categorias text[] NOT NULL DEFAULT '{}',
  contato_nome text,
  email text,
  telefone text,
  endereco jsonb DEFAULT '{}'::jsonb,
  dados_bancarios jsonb DEFAULT '{}'::jsonb,
  condicoes_comerciais text,
  prazo_medio_entrega_dias integer,
  status text NOT NULL DEFAULT 'ativo', -- ativo|inativo|bloqueado|em_homologacao
  avaliacao integer CHECK (avaliacao IS NULL OR (avaliacao BETWEEN 1 AND 5)),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_org ON public.suppliers(organization_id);
CREATE INDEX idx_suppliers_status ON public.suppliers(organization_id, status);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view suppliers" ON public.suppliers FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members create suppliers" ON public.suppliers FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update suppliers" ON public.suppliers FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete suppliers" ON public.suppliers FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice full access suppliers" ON public.suppliers
  USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 2. CODE GENERATOR
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_code_seq (
  organization_id uuid NOT NULL,
  prefix text NOT NULL,
  year integer NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, prefix, year)
);
ALTER TABLE public.purchase_code_seq ENABLE ROW LEVEL SECURITY;
-- No public policies; only used via SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.generate_purchase_code(_org uuid, _prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y integer := EXTRACT(YEAR FROM now())::int;
  next_seq integer;
BEGIN
  INSERT INTO public.purchase_code_seq (organization_id, prefix, year, last_seq)
  VALUES (_org, _prefix, y, 1)
  ON CONFLICT (organization_id, prefix, year)
  DO UPDATE SET last_seq = public.purchase_code_seq.last_seq + 1
  RETURNING last_seq INTO next_seq;
  RETURN _prefix || '-' || y::text || '-' || lpad(next_seq::text, 4, '0');
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. PURCHASE REQUESTS
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo text,
  user_id uuid NOT NULL, -- solicitante
  empresa_id uuid REFERENCES public.organizations(id),
  departamento text,
  cost_center_id uuid REFERENCES public.cost_centers(id),
  projeto text,
  data_solicitacao date NOT NULL DEFAULT current_date,
  data_desejada_entrega date,
  tipo_compra text NOT NULL, -- produto|servico|ativo_imobilizado|consumo|software_saas|manutencao|obra|recorrente|emergencial|investimento|outro
  categoria text,
  account_id uuid REFERENCES public.chart_of_accounts(id),
  descricao text,
  justificativa text,
  prioridade text NOT NULL DEFAULT 'media', -- baixa|media|alta|urgente
  valor_estimado numeric(14,2) NOT NULL DEFAULT 0,
  fora_orcamento boolean NOT NULL DEFAULT false,
  justificativa_orcamento text,
  status text NOT NULL DEFAULT 'rascunho', -- rascunho|enviada|em_analise|aprovada|reprovada|ajuste_solicitado|em_cotacao|pedido_gerado|cancelada|concluida
  contract_id uuid REFERENCES public.contracts(id),
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pr_org_status ON public.purchase_requests(organization_id, status);
CREATE INDEX idx_pr_user ON public.purchase_requests(user_id);
CREATE INDEX idx_pr_cc ON public.purchase_requests(cost_center_id);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view purchase_requests" ON public.purchase_requests FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members create purchase_requests" ON public.purchase_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update purchase_requests" ON public.purchase_requests FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete purchase_requests" ON public.purchase_requests FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice purchase_requests" ON public.purchase_requests
  USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

CREATE OR REPLACE FUNCTION public.set_purchase_request_codigo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.generate_purchase_code(NEW.organization_id, 'SOL');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pr_codigo BEFORE INSERT ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_purchase_request_codigo();

CREATE TRIGGER update_purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. PURCHASE REQUEST ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  nome text NOT NULL,
  descricao text,
  quantidade numeric(14,3) NOT NULL DEFAULT 1,
  unidade text DEFAULT 'un',
  valor_unitario numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  categoria text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pri_request ON public.purchase_request_items(request_id);
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access purchase_request_items" ON public.purchase_request_items
  USING (EXISTS (
    SELECT 1 FROM public.purchase_requests pr
    WHERE pr.id = request_id AND is_org_member(auth.uid(), pr.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_requests pr
    WHERE pr.id = request_id AND is_org_member(auth.uid(), pr.organization_id)
  ));

-- ----------------------------------------------------------------------------
-- 5. APPROVAL RULES
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  escopo text NOT NULL DEFAULT 'valor', -- valor|cost_center|categoria|tipo|fora_orcamento|emergencial
  cost_center_id uuid REFERENCES public.cost_centers(id),
  categoria text,
  tipo_compra text,
  valor_min numeric(14,2),
  valor_max numeric(14,2),
  approver_user_id uuid,
  approver_role text, -- owner|admin|gestor|financeiro|diretoria
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_par_org ON public.purchase_approval_rules(organization_id, ativo);

ALTER TABLE public.purchase_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view rules" ON public.purchase_approval_rules FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins manage rules" ON public.purchase_approval_rules
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']))
  WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice rules" ON public.purchase_approval_rules
  USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER update_par_updated_at
  BEFORE UPDATE ON public.purchase_approval_rules FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. APPROVALS (cadeia)
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  rule_id uuid REFERENCES public.purchase_approval_rules(id),
  approver_user_id uuid,
  approver_role text,
  ordem integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente', -- pendente|aprovado|reprovado|ajuste_solicitado|delegado
  comentario text,
  decided_at timestamptz,
  delegated_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pa_request ON public.purchase_approvals(request_id);
CREATE INDEX idx_pa_approver ON public.purchase_approvals(approver_user_id, status);

ALTER TABLE public.purchase_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view approvals" ON public.purchase_approvals FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members manage approvals" ON public.purchase_approvals
  FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "System inserts approvals" ON public.purchase_approvals FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Backoffice approvals" ON public.purchase_approvals
  USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

-- ----------------------------------------------------------------------------
-- 7. PURCHASE ORDERS
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo text,
  request_id uuid REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  empresa_id uuid REFERENCES public.organizations(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  account_id uuid REFERENCES public.chart_of_accounts(id),
  contract_id uuid REFERENCES public.contracts(id),
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  condicao_pagamento text,
  forma_pagamento text,
  data_emissao date NOT NULL DEFAULT current_date,
  data_prevista_entrega date,
  data_prevista_pagamento date,
  responsavel_user_id uuid,
  status text NOT NULL DEFAULT 'emitido', -- emitido|enviado|confirmado|parcialmente_recebido|recebido|aguardando_nf|nf_recebida|enviado_ap|cancelado|concluido
  observacoes text,
  pdf_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_org_status ON public.purchase_orders(organization_id, status);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_request ON public.purchase_orders(request_id);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view orders" ON public.purchase_orders FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members create orders" ON public.purchase_orders FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update orders" ON public.purchase_orders FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete orders" ON public.purchase_orders FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice orders" ON public.purchase_orders
  USING (has_backoffice_org_access(organization_id))
  WITH CHECK (has_backoffice_org_access(organization_id));

CREATE OR REPLACE FUNCTION public.set_purchase_order_codigo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.generate_purchase_code(NEW.organization_id, 'PED');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_po_codigo BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_purchase_order_codigo();

CREATE TRIGGER update_po_updated_at
  BEFORE UPDATE ON public.purchase_orders FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 8. PURCHASE ORDER ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  nome text NOT NULL,
  descricao text,
  quantidade numeric(14,3) NOT NULL DEFAULT 1,
  unidade text DEFAULT 'un',
  valor_unitario numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_poi_order ON public.purchase_order_items(order_id);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access poi" ON public.purchase_order_items
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = order_id AND is_org_member(auth.uid(), po.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = order_id AND is_org_member(auth.uid(), po.organization_id)
  ));

-- ----------------------------------------------------------------------------
-- 9. AUDIT LOG
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_type text NOT NULL, -- request|approval|order|rule
  entity_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pal_org ON public.purchase_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_pal_entity ON public.purchase_audit_log(entity_type, entity_id);
ALTER TABLE public.purchase_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view audit" ON public.purchase_audit_log FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert audit" ON public.purchase_audit_log FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ----------------------------------------------------------------------------
-- 10. CASHFLOW EXTENSION
-- ----------------------------------------------------------------------------
ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cashflow_purchase_order ON public.cashflow_entries(purchase_order_id);

-- ----------------------------------------------------------------------------
-- 11. STORAGE BUCKET
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchases', 'purchases', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members read purchases storage" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'purchases'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );
CREATE POLICY "Org members upload purchases storage" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'purchases'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );
CREATE POLICY "Org members update purchases storage" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'purchases'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );
CREATE POLICY "Org members delete purchases storage" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'purchases'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );

-- ----------------------------------------------------------------------------
-- 12. RPC: BUDGET CHECK
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_purchase_budget(
  _org uuid,
  _cost_center uuid,
  _account uuid,
  _competencia text, -- 'YYYY-MM'
  _valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_planejado numeric := 0;
  v_realizado numeric := 0;
  v_comprometido numeric := 0;
  v_saldo numeric;
  v_sit text;
  v_has_planning boolean := false;
BEGIN
  -- planejado: tenta ler de budget_items (financial_planning)
  BEGIN
    SELECT COALESCE(SUM(bi.valor),0), true INTO v_planejado, v_has_planning
    FROM public.budget_items bi
    WHERE bi.organization_id = _org
      AND (_cost_center IS NULL OR bi.cost_center_id = _cost_center)
      AND (_account IS NULL OR bi.account_id = _account)
      AND bi.competencia = _competencia;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_has_planning := false;
  END;

  -- realizado: cashflow já confirmado/pago no mês
  SELECT COALESCE(SUM(ABS(ce.valor)),0) INTO v_realizado
  FROM public.cashflow_entries ce
  WHERE ce.organization_id = _org
    AND (_cost_center IS NULL OR ce.cost_center_id = _cost_center)
    AND (_account IS NULL OR ce.account_id = _account)
    AND ce.tipo = 'saida'
    AND to_char(ce.data_vencimento, 'YYYY-MM') = _competencia
    AND ce.status IN ('pago','confirmado','realizado');

  -- comprometido: pedidos emitidos previstos no mês
  SELECT COALESCE(SUM(po.valor_total),0) INTO v_comprometido
  FROM public.purchase_orders po
  WHERE po.organization_id = _org
    AND (_cost_center IS NULL OR po.cost_center_id = _cost_center)
    AND (_account IS NULL OR po.account_id = _account)
    AND po.status NOT IN ('cancelado','concluido')
    AND to_char(COALESCE(po.data_prevista_pagamento, po.data_emissao), 'YYYY-MM') = _competencia;

  v_saldo := v_planejado - v_realizado - v_comprometido - COALESCE(_valor,0);

  IF NOT v_has_planning OR v_planejado = 0 THEN
    v_sit := 'sem_orcamento';
  ELSIF v_saldo < 0 THEN
    v_sit := 'acima_orcamento';
  ELSIF v_saldo < (v_planejado * 0.1) THEN
    v_sit := 'proximo_limite';
  ELSE
    v_sit := 'dentro_orcamento';
  END IF;

  RETURN jsonb_build_object(
    'planejado', v_planejado,
    'realizado', v_realizado,
    'comprometido', v_comprometido,
    'valor_solicitado', COALESCE(_valor,0),
    'saldo', v_saldo,
    'situacao', v_sit
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. TRIGGER: ORDER -> CASHFLOW PROVISIONAL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_order_to_cashflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_entity uuid;
BEGIN
  -- Apenas em criação ou ao mudar para 'emitido' / 'enviado_ap'
  IF (TG_OP = 'INSERT' AND NEW.status IN ('emitido','enviado_ap'))
     OR (TG_OP = 'UPDATE' AND NEW.status = 'enviado_ap' AND COALESCE(OLD.status,'') <> 'enviado_ap') THEN

    -- Resolve entity para o cashflow (entities), tentando reaproveitar o vínculo do supplier
    SELECT s.entity_id INTO v_supplier_entity FROM public.suppliers s WHERE s.id = NEW.supplier_id;

    -- Idempotente via source_ref
    INSERT INTO public.cashflow_entries (
      organization_id, tipo, valor, data_vencimento, descricao, status,
      account_id, cost_center_id, entity_id, contract_id,
      purchase_order_id, source, source_ref
    )
    SELECT
      NEW.organization_id, 'saida', NEW.valor_total,
      COALESCE(NEW.data_prevista_pagamento, NEW.data_emissao),
      'Pedido de Compra ' || COALESCE(NEW.codigo,''),
      'previsto',
      NEW.account_id, NEW.cost_center_id, v_supplier_entity, NEW.contract_id,
      NEW.id, 'compras', 'purchase_order:' || NEW.id::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cashflow_entries ce
      WHERE ce.source_ref = 'purchase_order:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_to_cashflow
  AFTER INSERT OR UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.purchase_order_to_cashflow();

-- ----------------------------------------------------------------------------
-- 14. TRIGGER: REQUEST AUTO-APPROVALS
-- Cria cadeia de aprovações ao mudar status para 'enviada'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_purchase_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_ordem integer := 0;
BEGIN
  IF NEW.status = 'enviada' AND COALESCE(OLD.status,'') <> 'enviada' THEN
    -- Limpa eventuais pendências antigas
    DELETE FROM public.purchase_approvals WHERE request_id = NEW.id AND status = 'pendente';

    FOR r IN
      SELECT * FROM public.purchase_approval_rules
      WHERE organization_id = NEW.organization_id
        AND ativo = true
        AND (
          (escopo = 'valor' AND
            COALESCE(valor_min, 0) <= NEW.valor_estimado AND
            (valor_max IS NULL OR valor_max >= NEW.valor_estimado))
          OR (escopo = 'cost_center' AND cost_center_id = NEW.cost_center_id)
          OR (escopo = 'categoria' AND categoria = NEW.categoria)
          OR (escopo = 'tipo' AND tipo_compra = NEW.tipo_compra)
          OR (escopo = 'fora_orcamento' AND NEW.fora_orcamento = true)
          OR (escopo = 'emergencial' AND NEW.tipo_compra = 'emergencial')
        )
      ORDER BY ordem ASC
    LOOP
      v_ordem := v_ordem + 1;
      INSERT INTO public.purchase_approvals(
        request_id, organization_id, rule_id, approver_user_id, approver_role, ordem
      ) VALUES (
        NEW.id, NEW.organization_id, r.id, r.approver_user_id, r.approver_role, v_ordem
      );
    END LOOP;

    -- Se nenhuma regra: aprovação direta dos owners da org
    IF v_ordem = 0 THEN
      INSERT INTO public.purchase_approvals(request_id, organization_id, approver_role, ordem)
      VALUES (NEW.id, NEW.organization_id, 'owner', 1);
    END IF;

    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
    NEW.status := 'em_analise';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pr_materialize_approvals
  BEFORE UPDATE OF status ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.materialize_purchase_approvals();

-- ----------------------------------------------------------------------------
-- 15. ORG DATA VERSION BUMP (para invalidar dashboard snapshot)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bump_org_data_version') THEN
    EXECUTE 'CREATE TRIGGER trg_pr_bump_version AFTER INSERT OR UPDATE OR DELETE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.bump_org_data_version()';
    EXECUTE 'CREATE TRIGGER trg_po_bump_version AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.bump_org_data_version()';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 16. REALTIME
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
