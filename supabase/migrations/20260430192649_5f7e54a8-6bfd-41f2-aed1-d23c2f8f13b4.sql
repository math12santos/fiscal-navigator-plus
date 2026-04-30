
-- ============================================================
-- MÓDULO TI — PATRIMÔNIO TECH, SISTEMAS, LINKS, CHAMADOS, SINISTROS
-- ============================================================

-- ============= ENUMS =============
CREATE TYPE public.it_equipment_type AS ENUM (
  'notebook','desktop','monitor','celular','tablet','impressora',
  'roteador','servidor','nobreak','periferico','outro'
);

CREATE TYPE public.it_equipment_status AS ENUM (
  'ativo','disponivel','em_uso','em_manutencao','extraviado','baixado','vendido','inativo'
);

CREATE TYPE public.it_conservation_state AS ENUM ('novo','bom','regular','ruim','sucata');

CREATE TYPE public.it_acquisition_form AS ENUM (
  'compra_a_vista','compra_parcelada','leasing','comodato','locacao','outro'
);

CREATE TYPE public.it_economic_status AS ENUM (
  'novo','em_uso_saudavel','proximo_substituicao','substituicao_recomendada','obsoleto'
);

CREATE TYPE public.it_system_category AS ENUM (
  'erp','crm','financeiro','rh','contabilidade','marketing','vendas',
  'comunicacao','armazenamento','seguranca','bi','automacao','outro'
);

CREATE TYPE public.it_billing_cycle AS ENUM (
  'mensal','anual','por_usuario','por_volume','por_consumo','vitalicio','outro'
);

CREATE TYPE public.it_system_status AS ENUM ('ativo','em_teste','cancelado','suspenso','em_implantacao');

CREATE TYPE public.it_criticality AS ENUM ('baixa','media','alta','critica');

CREATE TYPE public.it_telecom_type AS ENUM (
  'banda_larga','link_dedicado','telefonia_fixa','telefonia_movel',
  'chip_corporativo','vpn','mpls','outro'
);

CREATE TYPE public.it_telecom_status AS ENUM ('ativo','suspenso','cancelado','em_implantacao','em_analise');

CREATE TYPE public.it_ticket_priority AS ENUM ('baixa','media','alta','critica');

CREATE TYPE public.it_ticket_status AS ENUM (
  'aberto','em_analise','em_atendimento','aguardando_terceiro','aguardando_solicitante','resolvido','cancelado'
);

CREATE TYPE public.it_ticket_category AS ENUM (
  'suporte_tecnico','manutencao_equipamento','solicitacao_acesso','bloqueio_acesso',
  'instalacao_sistema','problema_sistema','problema_internet','problema_email',
  'solicitacao_compra','solicitacao_troca','seguranca_informacao','outro'
);

CREATE TYPE public.it_incident_type AS ENUM (
  'quebra_equipamento','furto','roubo','perda','dano_eletrico','dano_mau_uso',
  'indisponibilidade_sistema','indisponibilidade_internet','vazamento_dados',
  'acesso_indevido','ataque_cibernetico','falha_operacional','outro'
);

CREATE TYPE public.it_impact_level AS ENUM ('baixo','medio','alto','critico');

CREATE TYPE public.it_incident_status AS ENUM ('registrado','em_analise','em_tratativa','resolvido','encerrado');

-- ============= EQUIPMENT =============
CREATE TABLE public.it_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patrimonial_code TEXT NOT NULL,
  name TEXT NOT NULL,
  equipment_type public.it_equipment_type NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  department_id UUID,
  cost_center_id UUID,
  responsible_employee_id UUID,
  location TEXT,
  acquisition_date DATE,
  supplier_entity_id UUID,
  invoice_number TEXT,
  acquisition_value NUMERIC(14,2) DEFAULT 0,
  acquisition_form public.it_acquisition_form,
  installments_count INT,
  installment_value NUMERIC(14,2),
  first_installment_date DATE,
  status public.it_equipment_status NOT NULL DEFAULT 'disponivel',
  conservation_state public.it_conservation_state,
  useful_life_accounting_months INT,
  useful_life_economic_months INT,
  residual_value NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  -- Integração financeira
  enters_patrimonial_planning BOOLEAN DEFAULT true,
  generates_future_installments BOOLEAN DEFAULT false,
  generates_recurring_cost BOOLEAN DEFAULT false,
  generates_replacement_forecast BOOLEAN DEFAULT false,
  account_id UUID,
  contract_id UUID,
  -- Status econômico (calculado/manual)
  economic_status public.it_economic_status,
  -- Substituição futura
  replacement_forecast_date DATE,
  replacement_estimated_value NUMERIC(14,2),
  replacement_priority public.it_criticality,
  replacement_justification TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, patrimonial_code)
);

CREATE INDEX idx_it_equip_org ON public.it_equipment(organization_id);
CREATE INDEX idx_it_equip_status ON public.it_equipment(organization_id, status);
CREATE INDEX idx_it_equip_responsible ON public.it_equipment(responsible_employee_id);
CREATE INDEX idx_it_equip_cc ON public.it_equipment(cost_center_id);

ALTER TABLE public.it_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_equipment_select" ON public.it_equipment FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_equipment_insert" ON public.it_equipment FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "it_equipment_update" ON public.it_equipment FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_equipment_delete" ON public.it_equipment FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

-- Trigger updated_at
CREATE TRIGGER trg_it_equipment_updated BEFORE UPDATE ON public.it_equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: gera patrimonial_code sequencial por org (TI-000001)
CREATE OR REPLACE FUNCTION public.it_generate_patrimonial_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next INT;
BEGIN
  IF NEW.patrimonial_code IS NOT NULL AND length(trim(NEW.patrimonial_code)) > 0 THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX( CAST(NULLIF(regexp_replace(patrimonial_code,'[^0-9]','','g'),'') AS INT) ), 0) + 1
    INTO v_next FROM public.it_equipment WHERE organization_id = NEW.organization_id;
  NEW.patrimonial_code := 'TI-' || lpad(v_next::text, 6, '0');
  RETURN NEW;
END $$;

CREATE TRIGGER trg_it_equipment_code BEFORE INSERT ON public.it_equipment
  FOR EACH ROW EXECUTE FUNCTION public.it_generate_patrimonial_code();

-- ============= EQUIPMENT ATTACHMENTS =============
CREATE TABLE public.it_equipment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  equipment_id UUID NOT NULL REFERENCES public.it_equipment(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- nf, termo_entrega, termo_devolucao, foto, laudo, garantia, orcamento, outro
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_eq_att_eq ON public.it_equipment_attachments(equipment_id);
ALTER TABLE public.it_equipment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_eq_att_select" ON public.it_equipment_attachments FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_eq_att_insert" ON public.it_equipment_attachments FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND uploaded_by = auth.uid());
CREATE POLICY "it_eq_att_delete" ON public.it_equipment_attachments FOR DELETE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- ============= DEPRECIATION PARAMS =============
CREATE TABLE public.it_depreciation_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  equipment_id UUID NOT NULL UNIQUE REFERENCES public.it_equipment(id) ON DELETE CASCADE,
  -- Contábil
  invoice_gross_value NUMERIC(14,2),
  recoverable_taxes NUMERIC(14,2) DEFAULT 0,
  non_recoverable_taxes NUMERIC(14,2) DEFAULT 0,
  freight_install_setup NUMERIC(14,2) DEFAULT 0,
  discounts NUMERIC(14,2) DEFAULT 0,
  accounting_value NUMERIC(14,2),
  accounting_residual_value NUMERIC(14,2) DEFAULT 0,
  depreciable_base NUMERIC(14,2),
  accounting_useful_life_months INT,
  -- Econômica
  economic_useful_life_months INT,
  economic_residual_value NUMERIC(14,2) DEFAULT 0,
  monthly_economic_depreciation NUMERIC(14,2),
  current_economic_value NUMERIC(14,2),
  manual_economic_status public.it_economic_status,
  -- Workflow
  requires_finance_input BOOLEAN NOT NULL DEFAULT true,
  finance_completed_at TIMESTAMPTZ,
  finance_completed_by UUID,
  manually_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.it_depreciation_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_depr_select" ON public.it_depreciation_params FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_depr_insert" ON public.it_depreciation_params FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "it_depr_update" ON public.it_depreciation_params FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_depr_delete" ON public.it_depreciation_params FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_it_depr_updated BEFORE UPDATE ON public.it_depreciation_params
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-cria registro de depreciação pendente quando equipamento é criado
CREATE OR REPLACE FUNCTION public.it_auto_create_depreciation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.it_depreciation_params (organization_id, equipment_id, requires_finance_input, accounting_useful_life_months, economic_useful_life_months)
  VALUES (NEW.organization_id, NEW.id, true, NEW.useful_life_accounting_months, NEW.useful_life_economic_months)
  ON CONFLICT (equipment_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_it_eq_create_depr AFTER INSERT ON public.it_equipment
  FOR EACH ROW EXECUTE FUNCTION public.it_auto_create_depreciation();

-- ============= SYSTEMS =============
CREATE TABLE public.it_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.it_system_category NOT NULL,
  supplier_entity_id UUID,
  url TEXT,
  department_id UUID,
  cost_center_id UUID,
  responsible_employee_id UUID,
  users_count INT DEFAULT 1,
  billing_cycle public.it_billing_cycle NOT NULL DEFAULT 'mensal',
  monthly_value NUMERIC(14,2) DEFAULT 0,
  annual_value NUMERIC(14,2) DEFAULT 0,
  contracted_at DATE,
  renewal_date DATE,
  status public.it_system_status NOT NULL DEFAULT 'ativo',
  payment_method TEXT,
  contract_id UUID,
  admin_login TEXT,
  criticality public.it_criticality DEFAULT 'media',
  data_integrated BOOLEAN DEFAULT false,
  is_essential BOOLEAN DEFAULT false,
  has_redundancy BOOLEAN DEFAULT false,
  linked_to_budget BOOLEAN DEFAULT false,
  account_id UUID,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_sys_org ON public.it_systems(organization_id);
CREATE INDEX idx_it_sys_renewal ON public.it_systems(organization_id, renewal_date);
ALTER TABLE public.it_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_sys_select" ON public.it_systems FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_sys_insert" ON public.it_systems FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "it_sys_update" ON public.it_systems FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_sys_delete" ON public.it_systems FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_it_sys_updated BEFORE UPDATE ON public.it_systems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= TELECOM LINKS =============
CREATE TABLE public.it_telecom_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  link_type public.it_telecom_type NOT NULL,
  supplier_entity_id UUID,
  unit_location TEXT,
  cost_center_id UUID,
  responsible_employee_id UUID,
  speed TEXT,
  sla TEXT,
  fixed_ip BOOLEAN DEFAULT false,
  monthly_value NUMERIC(14,2) DEFAULT 0,
  contracted_at DATE,
  renewal_date DATE,
  invoice_due_day INT,
  status public.it_telecom_status NOT NULL DEFAULT 'ativo',
  contract_id UUID,
  linked_to_budget BOOLEAN DEFAULT false,
  account_id UUID,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_tel_org ON public.it_telecom_links(organization_id);
CREATE INDEX idx_it_tel_renewal ON public.it_telecom_links(organization_id, renewal_date);
ALTER TABLE public.it_telecom_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_tel_select" ON public.it_telecom_links FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_tel_insert" ON public.it_telecom_links FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "it_tel_update" ON public.it_telecom_links FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_tel_delete" ON public.it_telecom_links FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_it_tel_updated BEFORE UPDATE ON public.it_telecom_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= TICKETS =============
CREATE TABLE public.it_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requester_id UUID NOT NULL,
  department_id UUID,
  cost_center_id UUID,
  category public.it_ticket_category NOT NULL DEFAULT 'suporte_tecnico',
  priority public.it_ticket_priority NOT NULL DEFAULT 'media',
  status public.it_ticket_status NOT NULL DEFAULT 'aberto',
  assignee_id UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  equipment_id UUID REFERENCES public.it_equipment(id) ON DELETE SET NULL,
  system_id UUID REFERENCES public.it_systems(id) ON DELETE SET NULL,
  telecom_link_id UUID REFERENCES public.it_telecom_links(id) ON DELETE SET NULL,
  solution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, ticket_number)
);
CREATE INDEX idx_it_tk_org ON public.it_tickets(organization_id);
CREATE INDEX idx_it_tk_status ON public.it_tickets(organization_id, status);
CREATE INDEX idx_it_tk_assignee ON public.it_tickets(assignee_id);
CREATE INDEX idx_it_tk_requester ON public.it_tickets(requester_id);
ALTER TABLE public.it_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_tk_select" ON public.it_tickets FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_tk_insert" ON public.it_tickets FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND requester_id = auth.uid());
CREATE POLICY "it_tk_update" ON public.it_tickets FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_tk_delete" ON public.it_tickets FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_it_tk_updated BEFORE UPDATE ON public.it_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.it_generate_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next INT;
BEGIN
  IF NEW.ticket_number IS NOT NULL AND length(trim(NEW.ticket_number)) > 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX( CAST(NULLIF(regexp_replace(ticket_number,'[^0-9]','','g'),'') AS INT) ), 0) + 1
    INTO v_next FROM public.it_tickets WHERE organization_id = NEW.organization_id;
  NEW.ticket_number := '#' || lpad(v_next::text, 6, '0');
  RETURN NEW;
END $$;

CREATE TRIGGER trg_it_tk_number BEFORE INSERT ON public.it_tickets
  FOR EACH ROW EXECUTE FUNCTION public.it_generate_ticket_number();

-- ============= TICKET EVENTS =============
CREATE TABLE public.it_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES public.it_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'comment', -- comment, status_change, assignment
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_tk_ev_ticket ON public.it_ticket_events(ticket_id);
ALTER TABLE public.it_ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_tk_ev_select" ON public.it_ticket_events FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_tk_ev_insert" ON public.it_ticket_events FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND author_id = auth.uid());

-- ============= INCIDENTS =============
CREATE TABLE public.it_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_number TEXT NOT NULL,
  incident_type public.it_incident_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  department_id UUID,
  cost_center_id UUID,
  equipment_id UUID REFERENCES public.it_equipment(id) ON DELETE SET NULL,
  system_id UUID REFERENCES public.it_systems(id) ON DELETE SET NULL,
  telecom_link_id UUID REFERENCES public.it_telecom_links(id) ON DELETE SET NULL,
  description TEXT,
  operational_impact public.it_impact_level NOT NULL DEFAULT 'baixo',
  estimated_financial_impact NUMERIC(14,2) DEFAULT 0,
  caused_outage BOOLEAN DEFAULT false,
  outage_duration_minutes INT,
  analyst_id UUID,
  status public.it_incident_status NOT NULL DEFAULT 'registrado',
  corrective_action TEXT,
  preventive_action TEXT,
  police_report_number TEXT,
  insurance_triggered BOOLEAN DEFAULT false,
  insurance_claim_number TEXT,
  estimated_loss_value NUMERIC(14,2) DEFAULT 0,
  recovered_value NUMERIC(14,2) DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, incident_number)
);
CREATE INDEX idx_it_inc_org ON public.it_incidents(organization_id);
CREATE INDEX idx_it_inc_status ON public.it_incidents(organization_id, status);
ALTER TABLE public.it_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_inc_select" ON public.it_incidents FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_inc_insert" ON public.it_incidents FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "it_inc_update" ON public.it_incidents FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_inc_delete" ON public.it_incidents FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_it_inc_updated BEFORE UPDATE ON public.it_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.it_generate_incident_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next INT;
BEGIN
  IF NEW.incident_number IS NOT NULL AND length(trim(NEW.incident_number)) > 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX( CAST(NULLIF(regexp_replace(incident_number,'[^0-9]','','g'),'') AS INT) ), 0) + 1
    INTO v_next FROM public.it_incidents WHERE organization_id = NEW.organization_id;
  NEW.incident_number := 'INC-' || lpad(v_next::text, 6, '0');
  RETURN NEW;
END $$;

CREATE TRIGGER trg_it_inc_number BEFORE INSERT ON public.it_incidents
  FOR EACH ROW EXECUTE FUNCTION public.it_generate_incident_number();

-- ============= CONFIG =============
CREATE TABLE public.it_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  sla_baixa_hours INT DEFAULT 72,
  sla_media_hours INT DEFAULT 24,
  sla_alta_hours INT DEFAULT 8,
  sla_critica_hours INT DEFAULT 2,
  default_useful_life_notebook INT DEFAULT 60,
  default_useful_life_desktop INT DEFAULT 60,
  default_useful_life_monitor INT DEFAULT 60,
  default_useful_life_celular INT DEFAULT 36,
  default_useful_life_servidor INT DEFAULT 84,
  default_useful_life_outro INT DEFAULT 60,
  alert_renewal_days INT[] DEFAULT '{30,60,90}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.it_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_config_select" ON public.it_config FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_config_insert" ON public.it_config FOR INSERT
  WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));
CREATE POLICY "it_config_update" ON public.it_config FOR UPDATE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_it_config_updated BEFORE UPDATE ON public.it_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('it-attachments', 'it-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "it_att_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'it-attachments' AND (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id::text = (storage.foldername(name))[1] AND is_org_member(auth.uid(), o.id))
    OR has_backoffice_role(ARRAY['master','backoffice_admin'])
  ));
CREATE POLICY "it_att_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'it-attachments' AND
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id::text = (storage.foldername(name))[1] AND is_org_member(auth.uid(), o.id))
  );
CREATE POLICY "it_att_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'it-attachments' AND
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id::text = (storage.foldername(name))[1] AND is_org_member(auth.uid(), o.id))
  );
