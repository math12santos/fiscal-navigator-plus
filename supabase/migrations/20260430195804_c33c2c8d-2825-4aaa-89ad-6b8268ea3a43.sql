
-- ============================================================
-- TI EVOLUTION — Fase 1 (financeiro), Fase 2 (ciclo de vida), Fase 3 (SLA)
-- ============================================================

-- ============= ENUMS NOVOS =============
CREATE TYPE public.it_movement_type AS ENUM (
  'entrega','devolucao','transferencia','manutencao_envio','manutencao_retorno',
  'baixa','venda','extravio','reativacao','outro'
);

CREATE TYPE public.it_audit_action AS ENUM ('insert','update','delete','status_change');

-- ============= DEPRECIATION SCHEDULE =============
CREATE TABLE public.it_depreciation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.it_equipment(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- YYYY-MM
  month_index INT NOT NULL, -- 1..N
  monthly_accounting NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_economic NUMERIC(14,2) NOT NULL DEFAULT 0,
  accumulated_accounting NUMERIC(14,2) NOT NULL DEFAULT 0,
  accumulated_economic NUMERIC(14,2) NOT NULL DEFAULT 0,
  residual_accounting NUMERIC(14,2) NOT NULL DEFAULT 0,
  residual_economic NUMERIC(14,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, competencia)
);
CREATE INDEX idx_it_depr_sch_org ON public.it_depreciation_schedule(organization_id, competencia);
CREATE INDEX idx_it_depr_sch_eq ON public.it_depreciation_schedule(equipment_id);

ALTER TABLE public.it_depreciation_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_depr_sch_select" ON public.it_depreciation_schedule FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_depr_sch_modify" ON public.it_depreciation_schedule FOR ALL
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- ============= EQUIPMENT MOVEMENTS =============
CREATE TABLE public.it_equipment_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.it_equipment(id) ON DELETE CASCADE,
  movement_type public.it_movement_type NOT NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_employee_id UUID,
  to_employee_id UUID,
  from_location TEXT,
  to_location TEXT,
  from_status public.it_equipment_status,
  to_status public.it_equipment_status,
  reason TEXT,
  notes TEXT,
  document_path TEXT, -- termo PDF gerado
  document_signed_at TIMESTAMPTZ,
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_mov_eq ON public.it_equipment_movements(equipment_id, movement_date DESC);
CREATE INDEX idx_it_mov_org ON public.it_equipment_movements(organization_id);

ALTER TABLE public.it_equipment_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_mov_select" ON public.it_equipment_movements FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_mov_insert" ON public.it_equipment_movements FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND performed_by = auth.uid());
CREATE POLICY "it_mov_update" ON public.it_equipment_movements FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_mov_delete" ON public.it_equipment_movements FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

-- Trigger: ao inserir movimento, atualiza equipamento (responsável, local, status)
CREATE OR REPLACE FUNCTION public.it_apply_movement_to_equipment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Capturar estado anterior
  SELECT responsible_employee_id, location, status
    INTO NEW.from_employee_id, NEW.from_location, NEW.from_status
  FROM public.it_equipment WHERE id = NEW.equipment_id;

  -- Aplicar mudanças se fornecidas
  UPDATE public.it_equipment
    SET responsible_employee_id = COALESCE(NEW.to_employee_id, responsible_employee_id),
        location = COALESCE(NEW.to_location, location),
        status = COALESCE(NEW.to_status, status),
        updated_at = now()
    WHERE id = NEW.equipment_id;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_it_mov_apply BEFORE INSERT ON public.it_equipment_movements
  FOR EACH ROW EXECUTE FUNCTION public.it_apply_movement_to_equipment();

-- ============= TICKET COMMENTS =============
CREATE TABLE public.it_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES public.it_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  attachment_path TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_tk_cmt_ticket ON public.it_ticket_comments(ticket_id, created_at);

ALTER TABLE public.it_ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_tk_cmt_select" ON public.it_ticket_comments FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_tk_cmt_insert" ON public.it_ticket_comments FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND author_id = auth.uid());
CREATE POLICY "it_tk_cmt_delete" ON public.it_ticket_comments FOR DELETE
  USING (author_id = auth.uid() OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- ============= SLA POLICIES =============
CREATE TABLE public.it_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category public.it_ticket_category,
  priority public.it_ticket_priority NOT NULL,
  response_hours INT NOT NULL DEFAULT 4,
  resolution_hours INT NOT NULL DEFAULT 24,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, category, priority)
);
CREATE INDEX idx_it_sla_org ON public.it_sla_policies(organization_id);

ALTER TABLE public.it_sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_sla_select" ON public.it_sla_policies FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_sla_modify" ON public.it_sla_policies FOR ALL
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id))
  WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_it_sla_updated BEFORE UPDATE ON public.it_sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= TICKET SLA FIELDS =============
ALTER TABLE public.it_tickets
  ADD COLUMN IF NOT EXISTS sla_response_due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_resolution_due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_response_breach BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_resolution_breach BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS root_cause TEXT;

-- Trigger: aplica SLA ao criar/atualizar ticket
CREATE OR REPLACE FUNCTION public.it_apply_sla_to_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resp INT;
  v_resol INT;
BEGIN
  -- Procura política específica (categoria + prioridade), depois fallback (NULL category)
  SELECT response_hours, resolution_hours INTO v_resp, v_resol
  FROM public.it_sla_policies
  WHERE organization_id = NEW.organization_id
    AND active = true
    AND (category = NEW.category OR category IS NULL)
    AND priority = NEW.priority
  ORDER BY (category IS NOT NULL) DESC
  LIMIT 1;

  -- Defaults se não houver política
  IF v_resp IS NULL THEN
    v_resp := CASE NEW.priority
      WHEN 'critica' THEN 1
      WHEN 'alta' THEN 4
      WHEN 'media' THEN 8
      ELSE 24
    END;
  END IF;
  IF v_resol IS NULL THEN
    v_resol := CASE NEW.priority
      WHEN 'critica' THEN 4
      WHEN 'alta' THEN 12
      WHEN 'media' THEN 24
      ELSE 72
    END;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.priority IS DISTINCT FROM OLD.priority OR NEW.category IS DISTINCT FROM OLD.category THEN
    NEW.sla_response_due := NEW.opened_at + (v_resp || ' hours')::interval;
    NEW.sla_resolution_due := NEW.opened_at + (v_resol || ' hours')::interval;
  END IF;

  -- Marcar breach
  IF NEW.first_response_at IS NULL AND NEW.sla_response_due IS NOT NULL AND now() > NEW.sla_response_due THEN
    NEW.sla_response_breach := true;
  END IF;
  IF NEW.resolved_at IS NULL AND NEW.sla_resolution_due IS NOT NULL AND now() > NEW.sla_resolution_due THEN
    NEW.sla_resolution_breach := true;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_it_tk_sla ON public.it_tickets;
CREATE TRIGGER trg_it_tk_sla BEFORE INSERT OR UPDATE ON public.it_tickets
  FOR EACH ROW EXECUTE FUNCTION public.it_apply_sla_to_ticket();

-- ============= AUDIT LOG =============
CREATE TABLE public.it_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action public.it_audit_action NOT NULL,
  changed_by UUID,
  before_data JSONB,
  after_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_audit_org ON public.it_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_it_audit_record ON public.it_audit_log(table_name, record_id);

ALTER TABLE public.it_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_audit_select" ON public.it_audit_log FOR SELECT
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.it_log_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action public.it_audit_action;
  v_changed TEXT[] := ARRAY[]::TEXT[];
  v_org UUID;
  v_record UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert'; v_org := NEW.organization_id; v_record := NEW.id;
    INSERT INTO public.it_audit_log (organization_id, table_name, record_id, action, changed_by, after_data)
    VALUES (v_org, TG_TABLE_NAME, v_record, v_action, auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id; v_record := OLD.id;
    INSERT INTO public.it_audit_log (organization_id, table_name, record_id, action, changed_by, before_data)
    VALUES (v_org, TG_TABLE_NAME, v_record, 'delete', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  ELSE -- UPDATE
    v_org := NEW.organization_id; v_record := NEW.id;
    -- só registra se algo relevante mudou
    IF to_jsonb(NEW) - 'updated_at' = to_jsonb(OLD) - 'updated_at' THEN
      RETURN NEW;
    END IF;
    v_action := CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_change' ELSE 'update' END;
    INSERT INTO public.it_audit_log (organization_id, table_name, record_id, action, changed_by, before_data, after_data)
    VALUES (v_org, TG_TABLE_NAME, v_record, v_action, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER trg_it_audit_equipment AFTER INSERT OR UPDATE OR DELETE ON public.it_equipment
  FOR EACH ROW EXECUTE FUNCTION public.it_log_audit();
CREATE TRIGGER trg_it_audit_systems AFTER INSERT OR UPDATE OR DELETE ON public.it_systems
  FOR EACH ROW EXECUTE FUNCTION public.it_log_audit();
CREATE TRIGGER trg_it_audit_telecom AFTER INSERT OR UPDATE OR DELETE ON public.it_telecom_links
  FOR EACH ROW EXECUTE FUNCTION public.it_log_audit();
CREATE TRIGGER trg_it_audit_incidents AFTER INSERT OR UPDATE OR DELETE ON public.it_incidents
  FOR EACH ROW EXECUTE FUNCTION public.it_log_audit();

-- ============= RPC: GERAR CRONOGRAMA DE DEPRECIAÇÃO =============
CREATE OR REPLACE FUNCTION public.it_generate_depreciation_schedule(p_equipment_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eq RECORD;
  v_par RECORD;
  v_org UUID;
  v_start_date DATE;
  v_months_acc INT;
  v_months_eco INT;
  v_base_acc NUMERIC;
  v_base_eco NUMERIC;
  v_monthly_acc NUMERIC;
  v_monthly_eco NUMERIC;
  v_residual_acc NUMERIC;
  v_residual_eco NUMERIC;
  v_acc_acc NUMERIC := 0;
  v_acc_eco NUMERIC := 0;
  v_i INT;
  v_comp DATE;
  v_count INT := 0;
BEGIN
  SELECT e.*, e.organization_id AS org_id INTO v_eq FROM public.it_equipment e WHERE e.id = p_equipment_id;
  IF v_eq IS NULL THEN RAISE EXCEPTION 'Equipamento não encontrado'; END IF;
  v_org := v_eq.org_id;

  IF NOT (is_org_member(auth.uid(), v_org) OR has_backoffice_org_access(v_org)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT * INTO v_par FROM public.it_depreciation_params WHERE equipment_id = p_equipment_id;
  IF v_par IS NULL THEN RAISE EXCEPTION 'Parâmetros de depreciação não encontrados'; END IF;

  v_start_date := COALESCE(v_eq.acquisition_date, CURRENT_DATE);
  v_months_acc := COALESCE(v_par.accounting_useful_life_months, 0);
  v_months_eco := COALESCE(v_par.economic_useful_life_months, v_months_acc);
  v_base_acc := COALESCE(v_par.depreciable_base, COALESCE(v_par.accounting_value,0) - COALESCE(v_par.accounting_residual_value,0));
  v_base_eco := COALESCE(v_par.accounting_value,0) - COALESCE(v_par.economic_residual_value,0);
  v_residual_acc := COALESCE(v_par.accounting_residual_value, 0);
  v_residual_eco := COALESCE(v_par.economic_residual_value, 0);

  IF v_months_acc <= 0 THEN
    RAISE EXCEPTION 'Vida útil contábil deve ser > 0';
  END IF;

  v_monthly_acc := ROUND(v_base_acc / v_months_acc, 2);
  v_monthly_eco := CASE WHEN v_months_eco > 0 THEN ROUND(v_base_eco / v_months_eco, 2) ELSE 0 END;

  -- Limpa cronograma anterior
  DELETE FROM public.it_depreciation_schedule WHERE equipment_id = p_equipment_id;

  FOR v_i IN 1..GREATEST(v_months_acc, v_months_eco) LOOP
    v_comp := (date_trunc('month', v_start_date) + ((v_i - 1) || ' months')::interval)::date;
    v_acc_acc := LEAST(v_acc_acc + CASE WHEN v_i <= v_months_acc THEN v_monthly_acc ELSE 0 END, v_base_acc);
    v_acc_eco := LEAST(v_acc_eco + CASE WHEN v_i <= v_months_eco THEN v_monthly_eco ELSE 0 END, v_base_eco);

    INSERT INTO public.it_depreciation_schedule (
      organization_id, equipment_id, competencia, month_index,
      monthly_accounting, monthly_economic,
      accumulated_accounting, accumulated_economic,
      residual_accounting, residual_economic
    ) VALUES (
      v_org, p_equipment_id, to_char(v_comp, 'YYYY-MM'), v_i,
      CASE WHEN v_i <= v_months_acc THEN v_monthly_acc ELSE 0 END,
      CASE WHEN v_i <= v_months_eco THEN v_monthly_eco ELSE 0 END,
      v_acc_acc, v_acc_eco,
      GREATEST(v_base_acc - v_acc_acc + v_residual_acc, v_residual_acc),
      GREATEST(v_base_eco - v_acc_eco + v_residual_eco, v_residual_eco)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('months_generated', v_count, 'monthly_accounting', v_monthly_acc, 'monthly_economic', v_monthly_eco);
END $$;

-- ============= RPC: MATERIALIZAR CUSTOS RECORRENTES (sistemas + telecom) =============
CREATE OR REPLACE FUNCTION public.it_materialize_recurring_costs(p_org_id UUID, p_months_ahead INT DEFAULT 12)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted INT := 0;
  v_user UUID;
  v_sys RECORD;
  v_tel RECORD;
  v_i INT;
  v_date DATE;
  v_ref TEXT;
BEGIN
  IF NOT (is_org_member(auth.uid(), p_org_id) OR has_backoffice_org_access(p_org_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  v_user := auth.uid();

  -- SISTEMAS ativos com valor mensal > 0
  FOR v_sys IN
    SELECT * FROM public.it_systems
    WHERE organization_id = p_org_id AND status = 'ativo' AND COALESCE(monthly_value,0) > 0
  LOOP
    FOR v_i IN 0..p_months_ahead LOOP
      v_date := (date_trunc('month', CURRENT_DATE) + (v_i || ' months')::interval)::date
                + (COALESCE((v_sys.contracted_at)::date - date_trunc('month', v_sys.contracted_at)::date, 0)) * INTERVAL '0';
      v_ref := 'it_system:' || v_sys.id || ':' || to_char(v_date, 'YYYY-MM');

      INSERT INTO public.cashflow_entries (
        organization_id, user_id, tipo, descricao, valor_previsto, data_prevista, status,
        account_id, cost_center_id, entity_id, source, source_ref, competencia, recorrencia
      ) VALUES (
        p_org_id, v_user, 'pagar',
        'TI/Sistema: ' || v_sys.name || ' (' || to_char(v_date, 'MM/YYYY') || ')',
        v_sys.monthly_value, v_date, 'previsto',
        v_sys.account_id, v_sys.cost_center_id, v_sys.supplier_entity_id,
        'ti', v_ref, to_char(v_date, 'YYYY-MM'), 'mensal'
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN v_inserted := v_inserted + 1; END IF;
    END LOOP;
  END LOOP;

  -- TELECOM ativos com valor mensal > 0
  FOR v_tel IN
    SELECT * FROM public.it_telecom_links
    WHERE organization_id = p_org_id AND status = 'ativo' AND COALESCE(monthly_value,0) > 0
  LOOP
    FOR v_i IN 0..p_months_ahead LOOP
      v_date := (date_trunc('month', CURRENT_DATE) + (v_i || ' months')::interval)::date;
      IF v_tel.invoice_due_day IS NOT NULL AND v_tel.invoice_due_day BETWEEN 1 AND 28 THEN
        v_date := (date_trunc('month', v_date) + ((v_tel.invoice_due_day - 1) || ' days')::interval)::date;
      END IF;
      v_ref := 'it_telecom:' || v_tel.id || ':' || to_char(v_date, 'YYYY-MM');

      INSERT INTO public.cashflow_entries (
        organization_id, user_id, tipo, descricao, valor_previsto, data_prevista, status,
        account_id, cost_center_id, entity_id, source, source_ref, competencia, recorrencia
      ) VALUES (
        p_org_id, v_user, 'pagar',
        'TI/Link: ' || v_tel.name || ' (' || to_char(v_date, 'MM/YYYY') || ')',
        v_tel.monthly_value, v_date, 'previsto',
        v_tel.account_id, v_tel.cost_center_id, v_tel.supplier_entity_id,
        'ti', v_ref, to_char(v_date, 'YYYY-MM'), 'mensal'
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN v_inserted := v_inserted + 1; END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('entries_inserted', v_inserted, 'months_ahead', p_months_ahead);
END $$;

-- Garantir UNIQUE em (source, source_ref) para idempotência da materialização
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashflow_source_ref_unique
  ON public.cashflow_entries(source, source_ref)
  WHERE source_ref IS NOT NULL;

-- ============= RPC: MATERIALIZAR PARCELAS DE EQUIPAMENTOS =============
CREATE OR REPLACE FUNCTION public.it_materialize_equipment_installments(p_equipment_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eq RECORD;
  v_user UUID;
  v_i INT;
  v_date DATE;
  v_ref TEXT;
  v_inserted INT := 0;
BEGIN
  SELECT * INTO v_eq FROM public.it_equipment WHERE id = p_equipment_id;
  IF v_eq IS NULL THEN RAISE EXCEPTION 'Equipamento não encontrado'; END IF;
  IF NOT (is_org_member(auth.uid(), v_eq.organization_id) OR has_backoffice_org_access(v_eq.organization_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  v_user := auth.uid();

  IF v_eq.acquisition_form <> 'compra_parcelada' OR COALESCE(v_eq.installments_count,0) <= 0
     OR COALESCE(v_eq.installment_value,0) <= 0 OR v_eq.first_installment_date IS NULL THEN
    RETURN jsonb_build_object('entries_inserted', 0, 'reason', 'equipamento sem parcelas configuradas');
  END IF;

  FOR v_i IN 1..v_eq.installments_count LOOP
    v_date := v_eq.first_installment_date + ((v_i - 1) || ' months')::interval;
    v_ref := 'it_equipment_installment:' || v_eq.id || ':' || v_i;

    INSERT INTO public.cashflow_entries (
      organization_id, user_id, tipo, descricao, valor_previsto, data_prevista, status,
      account_id, cost_center_id, entity_id, source, source_ref, competencia, num_parcelas
    ) VALUES (
      v_eq.organization_id, v_user, 'pagar',
      'TI/Parcela ' || v_i || '/' || v_eq.installments_count || ': ' || v_eq.name,
      v_eq.installment_value, v_date, 'previsto',
      v_eq.account_id, v_eq.cost_center_id, v_eq.supplier_entity_id,
      'ti', v_ref, to_char(v_date, 'YYYY-MM'), v_eq.installments_count
    )
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('entries_inserted', v_inserted);
END $$;

-- ============= TRIGGER: regenerar projeções quando dados mudam =============
CREATE OR REPLACE FUNCTION public.it_invalidate_projections()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefix TEXT;
BEGIN
  -- Quando muda valor/status, remove projeções futuras (não-pagas) para serem regeradas pela próxima materialização
  IF TG_TABLE_NAME = 'it_systems' THEN
    v_prefix := 'it_system:' || COALESCE(NEW.id, OLD.id) || ':';
  ELSIF TG_TABLE_NAME = 'it_telecom_links' THEN
    v_prefix := 'it_telecom:' || COALESCE(NEW.id, OLD.id) || ':';
  ELSIF TG_TABLE_NAME = 'it_equipment' THEN
    v_prefix := 'it_equipment_installment:' || COALESCE(NEW.id, OLD.id) || ':';
  END IF;

  IF v_prefix IS NOT NULL THEN
    DELETE FROM public.cashflow_entries
    WHERE source = 'ti'
      AND source_ref LIKE v_prefix || '%'
      AND status NOT IN ('pago','recebido')
      AND data_prevista >= CURRENT_DATE;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_it_sys_invalidate AFTER UPDATE OF monthly_value, status, account_id, cost_center_id, supplier_entity_id ON public.it_systems
  FOR EACH ROW EXECUTE FUNCTION public.it_invalidate_projections();
CREATE TRIGGER trg_it_tel_invalidate AFTER UPDATE OF monthly_value, status, invoice_due_day, account_id, cost_center_id, supplier_entity_id ON public.it_telecom_links
  FOR EACH ROW EXECUTE FUNCTION public.it_invalidate_projections();
CREATE TRIGGER trg_it_eq_invalidate AFTER UPDATE OF acquisition_form, installments_count, installment_value, first_installment_date, status ON public.it_equipment
  FOR EACH ROW EXECUTE FUNCTION public.it_invalidate_projections();
