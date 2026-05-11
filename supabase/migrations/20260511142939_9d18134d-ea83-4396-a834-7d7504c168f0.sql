
-- ============================================================
-- COMPRAS - FASE 3: Recorrências + Vínculo Contratos/Ativos + Notificações + Settings
-- ============================================================

-- ===== SETTINGS =====
CREATE TABLE public.purchase_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  -- janelas de alerta
  alerta_aprovacao_pendente_dias INT NOT NULL DEFAULT 2,
  alerta_divergencia_aberta_dias INT NOT NULL DEFAULT 3,
  alerta_recorrencia_antecedencia_dias INT NOT NULL DEFAULT 7,
  -- política de ativos
  auto_criar_ativo_imobilizado BOOLEAN NOT NULL DEFAULT FALSE,
  vida_util_contabil_meses INT NOT NULL DEFAULT 60,
  vida_util_economica_meses INT NOT NULL DEFAULT 48,
  -- política de contratos
  auto_criar_contrato_recorrente BOOLEAN NOT NULL DEFAULT FALSE,
  -- horizonte de geração
  recorrencia_horizonte_meses INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read ps" ON public.purchase_settings FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org members write ps" ON public.purchase_settings FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE TRIGGER trg_ps_updated_at BEFORE UPDATE ON public.purchase_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== RECURRENCES =====
CREATE TABLE public.purchase_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  request_template_id UUID REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  tipo_compra TEXT NOT NULL DEFAULT 'recorrente',
  categoria TEXT,
  cost_center_id UUID,
  account_id UUID,
  valor_estimado NUMERIC(14,2) NOT NULL DEFAULT 0,
  periodicidade TEXT NOT NULL DEFAULT 'mensal',
  -- mensal | bimestral | trimestral | semestral | anual
  dia_geracao INT NOT NULL DEFAULT 1, -- dia do mês para gerar solicitação
  proxima_geracao DATE NOT NULL,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ultima_geracao_em TIMESTAMPTZ,
  ultima_request_id UUID,
  total_geracoes INT NOT NULL DEFAULT 0,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_recur_org ON public.purchase_recurrences(organization_id, ativo);
CREATE INDEX idx_pr_recur_next ON public.purchase_recurrences(proxima_geracao) WHERE ativo = TRUE;

ALTER TABLE public.purchase_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read recur" ON public.purchase_recurrences FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org members write recur" ON public.purchase_recurrences FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE TRIGGER trg_recur_updated_at BEFORE UPDATE ON public.purchase_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Função: avançar próxima geração =====
CREATE OR REPLACE FUNCTION public.fn_recur_next_date(_base DATE, _periodicidade TEXT)
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _periodicidade
    WHEN 'mensal'     THEN (_base + INTERVAL '1 month')::DATE
    WHEN 'bimestral'  THEN (_base + INTERVAL '2 month')::DATE
    WHEN 'trimestral' THEN (_base + INTERVAL '3 month')::DATE
    WHEN 'semestral'  THEN (_base + INTERVAL '6 month')::DATE
    WHEN 'anual'      THEN (_base + INTERVAL '1 year')::DATE
    ELSE (_base + INTERVAL '1 month')::DATE
  END
$$;

-- ===== Função: gerar solicitações pendentes a partir das recorrências =====
CREATE OR REPLACE FUNCTION public.fn_generate_recurring_purchases(_org UUID DEFAULT NULL, _horizonte_dias INT DEFAULT 30)
RETURNS TABLE(recurrence_id UUID, request_id UUID, competencia DATE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_new_req_id UUID;
  v_limit DATE := CURRENT_DATE + (_horizonte_dias || ' days')::INTERVAL;
BEGIN
  FOR r IN
    SELECT * FROM public.purchase_recurrences
    WHERE ativo = TRUE
      AND (_org IS NULL OR organization_id = _org)
      AND proxima_geracao <= v_limit
      AND (data_fim IS NULL OR proxima_geracao <= data_fim)
  LOOP
    INSERT INTO public.purchase_requests (
      organization_id, user_id, descricao, tipo_compra, prioridade,
      valor_estimado, categoria, cost_center_id, account_id, status, notes
    ) VALUES (
      r.organization_id, COALESCE(r.created_by, auth.uid()),
      r.nome || ' (recorrência ' || to_char(r.proxima_geracao, 'MM/YYYY') || ')',
      r.tipo_compra, 'media',
      r.valor_estimado, r.categoria, r.cost_center_id, r.account_id,
      'enviada',
      COALESCE(r.observacao, '') || E'\nGerada automaticamente a partir da recorrência ' || r.nome
    )
    RETURNING id INTO v_new_req_id;

    UPDATE public.purchase_recurrences
       SET ultima_geracao_em = now(),
           ultima_request_id = v_new_req_id,
           total_geracoes = total_geracoes + 1,
           proxima_geracao = public.fn_recur_next_date(proxima_geracao, periodicidade),
           ativo = CASE WHEN data_fim IS NOT NULL AND public.fn_recur_next_date(proxima_geracao, periodicidade) > data_fim THEN FALSE ELSE ativo END
     WHERE id = r.id;

    recurrence_id := r.id;
    request_id := v_new_req_id;
    competencia := r.proxima_geracao;
    RETURN NEXT;
  END LOOP;
  RETURN;
END $$;

-- ===== Trigger: ao confirmar pedido, opcionalmente cria ativo / contrato =====
CREATE OR REPLACE FUNCTION public.fn_po_after_confirm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings RECORD;
  v_new_eq UUID;
  v_new_contract UUID;
  v_patcode TEXT;
BEGIN
  IF NEW.status NOT IN ('confirmado', 'recebido', 'enviado_ap') THEN RETURN NEW; END IF;
  IF (OLD.status IS NOT NULL AND OLD.status = NEW.status) THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.purchase_settings WHERE organization_id = NEW.organization_id;

  -- Ativo imobilizado
  IF NEW.tipo_compra = 'ativo_imobilizado'
     AND COALESCE(v_settings.auto_criar_ativo_imobilizado, FALSE)
     AND NOT EXISTS(SELECT 1 FROM public.it_equipment WHERE invoice_number = ('PO:' || NEW.codigo)) THEN
    v_patcode := 'PAT-' || to_char(now(), 'YY') || '-' || lpad((extract(epoch from now())::INT % 100000)::TEXT, 5, '0');
    INSERT INTO public.it_equipment (
      organization_id, patrimonial_code, name, equipment_type,
      acquisition_date, acquisition_value, acquisition_form,
      useful_life_accounting_months, useful_life_economic_months,
      residual_value, status, invoice_number, created_by, acquisition_mode,
      enters_patrimonial_planning
    ) VALUES (
      NEW.organization_id, v_patcode, COALESCE(NEW.descricao, NEW.codigo), 'outro',
      COALESCE(NEW.data_emissao, CURRENT_DATE), NEW.valor_total, 'compra',
      COALESCE(v_settings.vida_util_contabil_meses, 60),
      COALESCE(v_settings.vida_util_economica_meses, 48),
      0, 'disponivel', 'PO:' || NEW.codigo, COALESCE(NEW.created_by, auth.uid()),
      'nova', TRUE
    ) RETURNING id INTO v_new_eq;
  END IF;

  -- Contrato recorrente
  IF NEW.tipo_compra IN ('recorrente', 'software_saas')
     AND COALESCE(v_settings.auto_criar_contrato_recorrente, FALSE)
     AND NOT EXISTS(SELECT 1 FROM public.contracts WHERE external_ref = ('PO:' || NEW.codigo)) THEN
    INSERT INTO public.contracts (
      organization_id, user_id, nome, tipo, valor, valor_base,
      tipo_recorrencia, status, source, external_ref, data_inicio,
      natureza_financeira, impacto_resultado
    ) VALUES (
      NEW.organization_id, COALESCE(NEW.created_by, auth.uid()),
      COALESCE(NEW.descricao, NEW.codigo), 'fornecedor',
      NEW.valor_total, NEW.valor_total,
      'mensal', 'Ativo', 'compras', 'PO:' || NEW.codigo,
      COALESCE(NEW.data_emissao, CURRENT_DATE),
      'fixo', 'custo'
    ) RETURNING id INTO v_new_contract;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_po_after_confirm AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_po_after_confirm();

-- ===== NOTIFICAÇÕES =====
-- Notificar aprovador quando aprovação é criada
CREATE OR REPLACE FUNCTION public.fn_notify_approval_pending()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF NEW.status = 'pendente' AND NEW.approver_user_id IS NOT NULL THEN
    SELECT codigo, descricao, valor_estimado INTO v_req FROM public.purchase_requests WHERE id = NEW.request_id;
    INSERT INTO public.notifications (organization_id, user_id, title, body, type, priority, reference_type, reference_id)
    VALUES (
      NEW.organization_id, NEW.approver_user_id,
      'Aprovação de compra pendente',
      'Solicitação ' || COALESCE(v_req.codigo, '?') || ' aguarda sua decisão (' || COALESCE(v_req.descricao, '') || ')',
      'warning', 'alta', 'purchase_approval', NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_approval_pending AFTER INSERT ON public.purchase_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_approval_pending();

-- Notificar criador quando divergência é aberta
CREATE OR REPLACE FUNCTION public.fn_notify_divergence_open()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NEW.status = 'aberta' THEN
    SELECT po.codigo, po.created_by INTO v_order FROM public.purchase_orders po WHERE po.id = NEW.order_id;
    IF v_order.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (organization_id, user_id, title, body, type, priority, reference_type, reference_id)
      VALUES (
        NEW.organization_id, v_order.created_by,
        'Divergência em recebimento',
        'Pedido ' || COALESCE(v_order.codigo, '?') || ' tem divergência aberta: ' || NEW.descricao,
        'error', CASE WHEN NEW.severidade = 'alta' THEN 'urgente' ELSE 'alta' END,
        'purchase_divergence', NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_divergence_open AFTER INSERT ON public.purchase_divergences
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_divergence_open();
