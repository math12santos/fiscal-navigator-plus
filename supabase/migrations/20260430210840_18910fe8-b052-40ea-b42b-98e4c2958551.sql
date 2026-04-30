-- =====================================================================
-- FASE 1 — Fechar o ciclo financeiro (CRM/TI/Jurídico → Cashflow)
-- =====================================================================

-- 1) Índice único de idempotência (source_ref por org/source)
CREATE UNIQUE INDEX IF NOT EXISTS cashflow_entries_source_ref_unique
  ON public.cashflow_entries(organization_id, source, source_ref)
  WHERE source_ref IS NOT NULL;

-- =====================================================================
-- 2) CRM Won → Contrato automático
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_generate_contract_from_opportunity(p_opportunity_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp RECORD;
  v_client RECORD;
  v_contract_id uuid;
BEGIN
  SELECT * INTO v_opp FROM public.crm_opportunities WHERE id = p_opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oportunidade não encontrada'; END IF;

  IF v_opp.contract_id IS NOT NULL THEN
    RETURN v_opp.contract_id;
  END IF;

  SELECT * INTO v_client FROM public.crm_clients WHERE id = v_opp.client_id;

  INSERT INTO public.contracts (
    organization_id, user_id, nome, tipo, valor, vencimento, status,
    source, notes,
    tipo_recorrencia, data_inicio, valor_base,
    natureza_financeira, impacto_resultado
  ) VALUES (
    v_opp.organization_id,
    v_opp.user_id,
    COALESCE(v_opp.title, 'Contrato CRM'),
    COALESCE(v_opp.contract_type, 'receita'),
    COALESCE(v_opp.estimated_value, 0),
    COALESCE(v_opp.estimated_close_date, CURRENT_DATE + INTERVAL '30 days'),
    'rascunho',
    'crm',
    'Gerado automaticamente da oportunidade ganha do CRM' ||
      CASE WHEN v_client.name IS NOT NULL THEN ' — ' || v_client.name ELSE '' END,
    COALESCE(v_opp.recurrence, 'mensal'),
    COALESCE(v_opp.estimated_close_date, CURRENT_DATE),
    COALESCE(v_opp.estimated_value, 0),
    'operacional',
    'receita_operacional'
  )
  RETURNING id INTO v_contract_id;

  UPDATE public.crm_opportunities
     SET contract_id = v_contract_id, updated_at = now()
   WHERE id = p_opportunity_id;

  RETURN v_contract_id;
END;
$$;

-- =====================================================================
-- 3) TI: Equipamento → Cashflow (CAPEX) — idempotente
-- =====================================================================
CREATE OR REPLACE FUNCTION public.it_equipment_post_to_cashflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
BEGIN
  v_ref := 'equipment:' || NEW.id::text;

  IF NEW.acquisition_value IS NULL OR NEW.acquisition_value <= 0 THEN
    DELETE FROM public.cashflow_entries
      WHERE organization_id = NEW.organization_id
        AND source = 'ti'
        AND source_ref = v_ref;
    RETURN NEW;
  END IF;

  INSERT INTO public.cashflow_entries (
    organization_id, user_id, tipo, categoria, descricao,
    valor_previsto, data_prevista, status,
    cost_center_id, account_id, entity_id,
    source, source_ref
  ) VALUES (
    NEW.organization_id,
    COALESCE(NEW.created_by, NEW.responsible_employee_id),
    'saida',
    'capex_ti',
    'Aquisição TI: ' || COALESCE(NEW.name, NEW.patrimonial_code, 'Equipamento'),
    NEW.acquisition_value,
    COALESCE(NEW.acquisition_date, CURRENT_DATE),
    CASE WHEN COALESCE(NEW.acquisition_date, CURRENT_DATE) <= CURRENT_DATE
         THEN 'realizado' ELSE 'previsto' END,
    NEW.cost_center_id,
    NEW.account_id,
    NEW.supplier_entity_id,
    'ti',
    v_ref
  )
  ON CONFLICT (organization_id, source, source_ref) WHERE source_ref IS NOT NULL
  DO UPDATE SET
    valor_previsto = EXCLUDED.valor_previsto,
    data_prevista = EXCLUDED.data_prevista,
    cost_center_id = EXCLUDED.cost_center_id,
    account_id = EXCLUDED.account_id,
    entity_id = EXCLUDED.entity_id,
    descricao = EXCLUDED.descricao,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_it_equipment_cashflow ON public.it_equipment;
CREATE TRIGGER trg_it_equipment_cashflow
AFTER INSERT OR UPDATE OF acquisition_value, acquisition_date, cost_center_id, account_id, supplier_entity_id, name
ON public.it_equipment
FOR EACH ROW
EXECUTE FUNCTION public.it_equipment_post_to_cashflow();

-- =====================================================================
-- 4) TI: Incidente → Cashflow (perda real líquida)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.it_incident_post_to_cashflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_loss numeric;
BEGIN
  v_ref := 'incident:' || NEW.id::text;
  v_loss := COALESCE(NEW.estimated_loss_value, 0) - COALESCE(NEW.recovered_value, 0);

  IF v_loss <= 0 THEN
    DELETE FROM public.cashflow_entries
      WHERE organization_id = NEW.organization_id
        AND source = 'ti'
        AND source_ref = v_ref;
    RETURN NEW;
  END IF;

  INSERT INTO public.cashflow_entries (
    organization_id, user_id, tipo, categoria, descricao,
    valor_previsto, data_prevista, status,
    cost_center_id,
    source, source_ref
  ) VALUES (
    NEW.organization_id,
    NEW.created_by,
    'saida',
    'sinistro_ti',
    'Sinistro TI: ' || COALESCE(NEW.incident_number, 'incidente') ||
      CASE WHEN NEW.description IS NOT NULL
           THEN ' — ' || left(NEW.description, 80) ELSE '' END,
    v_loss,
    COALESCE(NEW.occurred_at::date, CURRENT_DATE),
    'realizado',
    NEW.cost_center_id,
    'ti',
    v_ref
  )
  ON CONFLICT (organization_id, source, source_ref) WHERE source_ref IS NOT NULL
  DO UPDATE SET
    valor_previsto = EXCLUDED.valor_previsto,
    data_prevista = EXCLUDED.data_prevista,
    cost_center_id = EXCLUDED.cost_center_id,
    descricao = EXCLUDED.descricao,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_it_incident_cashflow ON public.it_incidents;
CREATE TRIGGER trg_it_incident_cashflow
AFTER INSERT OR UPDATE OF estimated_loss_value, recovered_value, occurred_at, cost_center_id
ON public.it_incidents
FOR EACH ROW
EXECUTE FUNCTION public.it_incident_post_to_cashflow();

-- =====================================================================
-- 5) Helpers de status no Jurídico
-- =====================================================================
CREATE OR REPLACE FUNCTION public.juridico_settlement_cashflow_status(p_settlement_id uuid)
RETURNS TABLE(parcelas_lancadas int, parcelas_total int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.cashflow_entries ce
       WHERE ce.source = 'juridico'
         AND ce.source_ref LIKE 'settlement:' || p_settlement_id::text || ':%'),
    (SELECT COUNT(*)::int FROM public.juridico_settlement_installments
       WHERE settlement_id = p_settlement_id);
$$;

CREATE OR REPLACE FUNCTION public.juridico_expense_is_posted(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cashflow_entries
     WHERE source = 'juridico'
       AND source_ref = 'expense:' || p_expense_id::text
  );
$$;