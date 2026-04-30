-- ============================================================
-- MÓDULO JURÍDICO - MIGRATION COMPLETA
-- ============================================================

-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.juridico_polo AS ENUM ('ativo', 'passivo', 'terceiro_interessado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.juridico_probabilidade AS ENUM ('remota', 'possivel', 'provavel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.juridico_status AS ENUM ('ativo', 'suspenso', 'arquivado', 'extinto', 'transitado_julgado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.juridico_instancia AS ENUM ('primeira', 'segunda', 'superior', 'extraordinaria');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.juridico_natureza AS ENUM ('civel', 'trabalhista', 'tributario', 'criminal', 'administrativo', 'familia', 'consumidor', 'outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.juridico_settlement_status AS ENUM ('proposto', 'aprovado', 'em_pagamento', 'concluido', 'cancelado', 'inadimplente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.juridico_expense_type AS ENUM ('honorario', 'custas', 'deposito_judicial', 'pericia', 'preposto', 'viagem', 'outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1. juridico_config
-- ============================================================
CREATE TABLE public.juridico_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  pct_provisao_remota NUMERIC NOT NULL DEFAULT 0,
  pct_provisao_possivel NUMERIC NOT NULL DEFAULT 25,
  pct_provisao_provavel NUMERIC NOT NULL DEFAULT 100,
  account_id_provisao UUID,
  account_id_honorarios UUID,
  account_id_custas UUID,
  account_id_acordos UUID,
  cost_center_id_default UUID,
  alert_days_before_audiencia INT DEFAULT 7,
  alert_days_before_prazo INT DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.juridico_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_config_select" ON public.juridico_config FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_config_modify" ON public.juridico_config FOR ALL
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id))
  WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_juridico_config_updated BEFORE UPDATE ON public.juridico_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. juridico_processes
-- ============================================================
CREATE TABLE public.juridico_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  -- Identificação
  numero_cnj TEXT,
  numero_interno TEXT,
  natureza public.juridico_natureza NOT NULL DEFAULT 'civel',
  classe TEXT,
  assunto TEXT,
  -- Partes
  polo public.juridico_polo NOT NULL DEFAULT 'passivo',
  parte_contraria TEXT,
  parte_contraria_documento TEXT,
  -- Foro
  comarca TEXT,
  uf TEXT,
  vara TEXT,
  tribunal TEXT,
  instancia public.juridico_instancia DEFAULT 'primeira',
  -- Status & Risco
  status public.juridico_status NOT NULL DEFAULT 'ativo',
  fase TEXT,
  probabilidade public.juridico_probabilidade NOT NULL DEFAULT 'possivel',
  risco_observacao TEXT,
  -- Financeiro
  valor_causa NUMERIC DEFAULT 0,
  valor_estimado_perda NUMERIC DEFAULT 0,
  valor_provisionado NUMERIC DEFAULT 0,
  valor_depositado NUMERIC DEFAULT 0,
  -- Datas
  data_distribuicao DATE,
  data_citacao DATE,
  data_proxima_audiencia TIMESTAMPTZ,
  data_proximo_prazo TIMESTAMPTZ,
  -- Responsáveis
  advogado_responsavel TEXT,
  escritorio_externo TEXT,
  -- Integrações
  cost_center_id UUID,
  contract_id UUID,
  -- Meta
  observacoes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_juridico_proc_org ON public.juridico_processes(organization_id);
CREATE INDEX idx_juridico_proc_status ON public.juridico_processes(organization_id, status);
CREATE INDEX idx_juridico_proc_prob ON public.juridico_processes(organization_id, probabilidade);
CREATE INDEX idx_juridico_proc_audiencia ON public.juridico_processes(organization_id, data_proxima_audiencia);

ALTER TABLE public.juridico_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_proc_select" ON public.juridico_processes FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_proc_insert" ON public.juridico_processes FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_proc_update" ON public.juridico_processes FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_proc_delete" ON public.juridico_processes FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_juridico_proc_updated BEFORE UPDATE ON public.juridico_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função de cálculo automático de provisão
CREATE OR REPLACE FUNCTION public.juridico_compute_provision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg RECORD;
  v_pct NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM public.juridico_config WHERE organization_id = NEW.organization_id;
  v_pct := CASE NEW.probabilidade
    WHEN 'remota'   THEN COALESCE(v_cfg.pct_provisao_remota, 0)
    WHEN 'possivel' THEN COALESCE(v_cfg.pct_provisao_possivel, 25)
    WHEN 'provavel' THEN COALESCE(v_cfg.pct_provisao_provavel, 100)
  END;
  NEW.valor_provisionado := ROUND(COALESCE(NEW.valor_estimado_perda, 0) * v_pct / 100.0, 2);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_juridico_proc_provision BEFORE INSERT OR UPDATE OF probabilidade, valor_estimado_perda
  ON public.juridico_processes
  FOR EACH ROW EXECUTE FUNCTION public.juridico_compute_provision();

-- ============================================================
-- 3. juridico_settlements (acordos)
-- ============================================================
CREATE TABLE public.juridico_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  process_id UUID NOT NULL REFERENCES public.juridico_processes(id) ON DELETE CASCADE,
  user_id UUID,
  numero_acordo TEXT,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  qtd_parcelas INT NOT NULL DEFAULT 1,
  data_primeira_parcela DATE NOT NULL,
  status public.juridico_settlement_status NOT NULL DEFAULT 'proposto',
  data_aprovacao TIMESTAMPTZ,
  aprovado_por UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_juridico_settle_org ON public.juridico_settlements(organization_id);
CREATE INDEX idx_juridico_settle_proc ON public.juridico_settlements(process_id);

ALTER TABLE public.juridico_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_settle_select" ON public.juridico_settlements FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_settle_insert" ON public.juridico_settlements FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_settle_update" ON public.juridico_settlements FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_settle_delete" ON public.juridico_settlements FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_juridico_settle_updated BEFORE UPDATE ON public.juridico_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. juridico_settlement_installments
-- ============================================================
CREATE TABLE public.juridico_settlement_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  settlement_id UUID NOT NULL REFERENCES public.juridico_settlements(id) ON DELETE CASCADE,
  numero_parcela INT NOT NULL,
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  cashflow_entry_id UUID,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_juridico_inst_settle ON public.juridico_settlement_installments(settlement_id);

ALTER TABLE public.juridico_settlement_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_inst_select" ON public.juridico_settlement_installments FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_inst_modify" ON public.juridico_settlement_installments FOR ALL
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- ============================================================
-- 5. juridico_expenses
-- ============================================================
CREATE TABLE public.juridico_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  process_id UUID NOT NULL REFERENCES public.juridico_processes(id) ON DELETE CASCADE,
  user_id UUID,
  tipo public.juridico_expense_type NOT NULL,
  descricao TEXT,
  valor NUMERIC NOT NULL,
  data_despesa DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  fornecedor_id UUID,
  cashflow_entry_id UUID,
  posted_to_cashflow BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_juridico_exp_proc ON public.juridico_expenses(process_id);
CREATE INDEX idx_juridico_exp_org ON public.juridico_expenses(organization_id);

ALTER TABLE public.juridico_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_exp_select" ON public.juridico_expenses FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_exp_insert" ON public.juridico_expenses FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_exp_update" ON public.juridico_expenses FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_exp_delete" ON public.juridico_expenses FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(organization_id));

CREATE TRIGGER trg_juridico_exp_updated BEFORE UPDATE ON public.juridico_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. juridico_movements (andamentos)
-- ============================================================
CREATE TABLE public.juridico_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  process_id UUID NOT NULL REFERENCES public.juridico_processes(id) ON DELETE CASCADE,
  data_movimento TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT,
  descricao TEXT NOT NULL,
  prazo_dias INT,
  data_prazo DATE,
  cumprido BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_juridico_mov_proc ON public.juridico_movements(process_id);

ALTER TABLE public.juridico_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_mov_select" ON public.juridico_movements FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_mov_modify" ON public.juridico_movements FOR ALL
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- ============================================================
-- 7. juridico_documents
-- ============================================================
CREATE TABLE public.juridico_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  process_id UUID NOT NULL REFERENCES public.juridico_processes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.juridico_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_doc_select" ON public.juridico_documents FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_doc_modify" ON public.juridico_documents FOR ALL
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- ============================================================
-- 8. juridico_audit_log
-- ============================================================
CREATE TABLE public.juridico_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  process_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  changed_by UUID,
  before_data JSONB,
  after_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_juridico_audit_proc ON public.juridico_audit_log(process_id);

ALTER TABLE public.juridico_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_audit_select" ON public.juridico_audit_log FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));
CREATE POLICY "juridico_audit_insert" ON public.juridico_audit_log FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

-- ============================================================
-- RPC: Aprovar acordo e materializar parcelas no fluxo de caixa
-- ============================================================
CREATE OR REPLACE FUNCTION public.juridico_approve_settlement(p_settlement_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settle RECORD;
  v_process RECORD;
  v_cfg RECORD;
  v_inst RECORD;
  v_cashflow_id UUID;
  v_count INT := 0;
BEGIN
  SELECT * INTO v_settle FROM public.juridico_settlements WHERE id = p_settlement_id;
  IF v_settle IS NULL THEN
    RAISE EXCEPTION 'Acordo não encontrado';
  END IF;

  IF NOT (has_org_role(auth.uid(), v_settle.organization_id, ARRAY['owner','admin']) OR has_backoffice_org_access(v_settle.organization_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT * INTO v_process FROM public.juridico_processes WHERE id = v_settle.process_id;
  SELECT * INTO v_cfg FROM public.juridico_config WHERE organization_id = v_settle.organization_id;

  -- Atualiza status
  UPDATE public.juridico_settlements
    SET status = 'aprovado',
        data_aprovacao = now(),
        aprovado_por = auth.uid()
    WHERE id = p_settlement_id;

  -- Materializa parcelas no cashflow
  FOR v_inst IN
    SELECT * FROM public.juridico_settlement_installments
    WHERE settlement_id = p_settlement_id
    ORDER BY numero_parcela
  LOOP
    INSERT INTO public.cashflow_entries (
      organization_id, user_id, descricao, valor_previsto, data_prevista,
      tipo, status, source, source_ref, account_id, cost_center_id, competencia
    ) VALUES (
      v_settle.organization_id,
      v_settle.user_id,
      'Acordo Jurídico ' || COALESCE(v_settle.numero_acordo, p_settlement_id::text) || ' - Parcela ' || v_inst.numero_parcela || '/' || v_settle.qtd_parcelas,
      v_inst.valor,
      v_inst.data_vencimento,
      'saida'::cashflow_tipo,
      'previsto'::cashflow_status,
      'juridico',
      'settlement:' || p_settlement_id || ':' || v_inst.numero_parcela,
      COALESCE(v_cfg.account_id_acordos, v_process.cost_center_id),
      COALESCE(v_process.cost_center_id, v_cfg.cost_center_id_default),
      to_char(v_inst.data_vencimento, 'YYYY-MM')
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cashflow_id;

    IF v_cashflow_id IS NOT NULL THEN
      UPDATE public.juridico_settlement_installments
        SET cashflow_entry_id = v_cashflow_id
        WHERE id = v_inst.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Audit
  INSERT INTO public.juridico_audit_log (organization_id, process_id, entity_type, entity_id, action, changed_by, after_data)
  VALUES (v_settle.organization_id, v_settle.process_id, 'settlement', p_settlement_id, 'approve', auth.uid(), jsonb_build_object('parcelas_geradas', v_count));

  RETURN jsonb_build_object('success', true, 'parcelas_geradas', v_count);
END $$;

-- ============================================================
-- RPC: Postar despesa no fluxo de caixa (idempotente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.juridico_post_expense_to_cashflow(p_expense_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp RECORD;
  v_proc RECORD;
  v_cfg RECORD;
  v_account UUID;
  v_cashflow_id UUID;
  v_data DATE;
BEGIN
  SELECT * INTO v_exp FROM public.juridico_expenses WHERE id = p_expense_id;
  IF v_exp IS NULL THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;

  IF NOT (is_org_member(auth.uid(), v_exp.organization_id) OR has_backoffice_org_access(v_exp.organization_id)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF v_exp.posted_to_cashflow AND v_exp.cashflow_entry_id IS NOT NULL THEN
    RETURN v_exp.cashflow_entry_id;
  END IF;

  SELECT * INTO v_proc FROM public.juridico_processes WHERE id = v_exp.process_id;
  SELECT * INTO v_cfg FROM public.juridico_config WHERE organization_id = v_exp.organization_id;

  v_account := CASE v_exp.tipo
    WHEN 'honorario' THEN v_cfg.account_id_honorarios
    WHEN 'custas' THEN v_cfg.account_id_custas
    ELSE v_cfg.account_id_honorarios
  END;

  v_data := COALESCE(v_exp.data_vencimento, v_exp.data_despesa);

  INSERT INTO public.cashflow_entries (
    organization_id, user_id, descricao, valor_previsto, data_prevista,
    tipo, status, source, source_ref, account_id, cost_center_id, entity_id, competencia
  ) VALUES (
    v_exp.organization_id, v_exp.user_id,
    'Jurídico - ' || v_exp.tipo::text || ' - ' || COALESCE(v_exp.descricao, v_proc.numero_cnj, ''),
    v_exp.valor, v_data,
    'saida'::cashflow_tipo, 'previsto'::cashflow_status,
    'juridico', 'expense:' || p_expense_id,
    v_account,
    COALESCE(v_proc.cost_center_id, v_cfg.cost_center_id_default),
    v_exp.fornecedor_id,
    to_char(v_data, 'YYYY-MM')
  )
  RETURNING id INTO v_cashflow_id;

  UPDATE public.juridico_expenses
    SET posted_to_cashflow = true, cashflow_entry_id = v_cashflow_id
    WHERE id = p_expense_id;

  RETURN v_cashflow_id;
END $$;

-- ============================================================
-- Storage bucket para documentos jurídicos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('juridico-docs', 'juridico-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "juridico_docs_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'juridico-docs'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "juridico_docs_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'juridico-docs'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "juridico_docs_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'juridico-docs'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
      AND om.role IN ('owner','admin')
    )
  );