
ALTER TABLE public.it_equipment
  ADD COLUMN IF NOT EXISTS home_office boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acquisition_mode text NOT NULL DEFAULT 'existente' CHECK (acquisition_mode IN ('nova','existente')),
  ADD COLUMN IF NOT EXISTS acquisition_estimated_month text,
  ADD COLUMN IF NOT EXISTS responsibility_term_path text,
  ADD COLUMN IF NOT EXISTS responsibility_term_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_subtype text,
  ADD COLUMN IF NOT EXISTS specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS next_replacement_review_date date;

-- Trigger: ao inserir aquisição nova, cria solicitação para Financeiro + tarefa de revisão semestral
CREATE OR REPLACE FUNCTION public.it_equipment_post_finance_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
  v_desc jsonb;
BEGIN
  -- Default depreciação sugerida quando não preenchida
  IF NEW.useful_life_accounting_months IS NULL THEN
    NEW.useful_life_accounting_months := 60;
  END IF;
  IF NEW.useful_life_economic_months IS NULL THEN
    NEW.useful_life_economic_months := 48;
  END IF;

  -- Próxima revisão de valor de substituição em 6 meses
  IF NEW.next_replacement_review_date IS NULL THEN
    NEW.next_replacement_review_date := COALESCE(NEW.acquisition_date, CURRENT_DATE) + INTERVAL '6 months';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_it_eq_pre_defaults ON public.it_equipment;
CREATE TRIGGER trg_it_eq_pre_defaults
BEFORE INSERT ON public.it_equipment
FOR EACH ROW EXECUTE FUNCTION public.it_equipment_post_finance_request();

-- After insert: cria solicitação para o financeiro confirmar depreciação (apenas para aquisições novas com valor)
CREATE OR REPLACE FUNCTION public.it_equipment_create_finance_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desc jsonb;
BEGIN
  IF NEW.acquisition_mode = 'nova' AND COALESCE(NEW.acquisition_value, 0) > 0 THEN
    v_desc := jsonb_build_object(
      'kind', 'ti_acquisition',
      'subtype', 'expense',
      'equipment_id', NEW.id,
      'equipment_name', NEW.name,
      'equipment_type', NEW.equipment_type,
      'amount', NEW.acquisition_value,
      'suggested_depreciation_accounting_months', COALESCE(NEW.useful_life_accounting_months, 60),
      'suggested_depreciation_economic_months', COALESCE(NEW.useful_life_economic_months, 48),
      'enters_patrimonial_planning', COALESCE(NEW.enters_patrimonial_planning, true),
      'generates_replacement_forecast', COALESCE(NEW.generates_replacement_forecast, true)
    );

    INSERT INTO public.requests (
      organization_id, user_id, title, type, area_responsavel,
      description, priority, reference_module, reference_id, status,
      cost_center_id, account_id
    ) VALUES (
      NEW.organization_id, NEW.created_by,
      'Aquisição TI: ' || COALESCE(NEW.name, NEW.patrimonial_code),
      'expense_request', 'financeiro',
      v_desc::text, 'media', 'ti', NEW.id, 'aberta',
      NEW.cost_center_id, NEW.account_id
    );
  END IF;

  -- Tarefa de revisão semestral do valor de substituição
  IF NEW.next_replacement_review_date IS NOT NULL THEN
    INSERT INTO public.requests (
      organization_id, user_id, title, type, area_responsavel,
      description, priority, reference_module, reference_id, status, due_date
    ) VALUES (
      NEW.organization_id, NEW.created_by,
      'Revisar valor de substituição: ' || COALESCE(NEW.name, NEW.patrimonial_code),
      'operacional', 'ti',
      'Atualizar VALOR DE SUBSTITUIÇÃO (pesquisar similares online).',
      'baixa', 'ti', NEW.id, 'aberta',
      NEW.next_replacement_review_date
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_it_eq_finance_request ON public.it_equipment;
CREATE TRIGGER trg_it_eq_finance_request
AFTER INSERT ON public.it_equipment
FOR EACH ROW EXECUTE FUNCTION public.it_equipment_create_finance_request();
