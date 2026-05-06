
CREATE TABLE public.it_equipment_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_it_kits_org ON public.it_equipment_kits(organization_id);

CREATE TABLE public.it_equipment_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.it_equipment_kits(id) ON DELETE CASCADE,
  equipment_type it_equipment_type NOT NULL,
  equipment_subtype text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  suggested_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_kit_items_kit ON public.it_equipment_kit_items(kit_id);

CREATE TABLE public.it_employee_kit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  kit_id uuid NOT NULL REFERENCES public.it_equipment_kits(id),
  employee_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','parcial','devolvido')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_it_kit_assign_org ON public.it_employee_kit_assignments(organization_id);
CREATE INDEX idx_it_kit_assign_emp ON public.it_employee_kit_assignments(employee_id);

ALTER TABLE public.it_equipment_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_equipment_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_employee_kit_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kits_org_access" ON public.it_equipment_kits
  FOR ALL USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "kit_items_org_access" ON public.it_equipment_kit_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.it_equipment_kits k WHERE k.id = kit_id AND is_org_member(auth.uid(), k.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.it_equipment_kits k WHERE k.id = kit_id AND is_org_member(auth.uid(), k.organization_id)));

CREATE POLICY "kit_assign_org_access" ON public.it_employee_kit_assignments
  FOR ALL USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_kits_updated BEFORE UPDATE ON public.it_equipment_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.it_assign_kit_to_employee(
  p_kit_id uuid, p_employee_id uuid, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid; v_user uuid; v_assign_id uuid;
  v_item record; v_eq record;
  v_allocated int := 0; v_missing jsonb := '[]'::jsonb;
  v_needed int;
BEGIN
  SELECT organization_id INTO v_org FROM public.it_equipment_kits WHERE id = p_kit_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Kit not found'; END IF;
  v_user := auth.uid();
  IF NOT is_org_member(v_user, v_org) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  INSERT INTO public.it_employee_kit_assignments (organization_id, kit_id, employee_id, notes, created_by)
  VALUES (v_org, p_kit_id, p_employee_id, p_notes, v_user)
  RETURNING id INTO v_assign_id;

  FOR v_item IN SELECT * FROM public.it_equipment_kit_items WHERE kit_id = p_kit_id LOOP
    v_needed := v_item.quantity;
    FOR v_eq IN
      SELECT id FROM public.it_equipment
      WHERE organization_id = v_org
        AND equipment_type = v_item.equipment_type
        AND (v_item.equipment_subtype IS NULL OR equipment_subtype = v_item.equipment_subtype)
        AND status = 'disponivel'
        AND responsible_employee_id IS NULL
      LIMIT v_needed
    LOOP
      UPDATE public.it_equipment
      SET responsible_employee_id = p_employee_id, status = 'em_uso', updated_at = now()
      WHERE id = v_eq.id;
      v_allocated := v_allocated + 1;
      v_needed := v_needed - 1;
    END LOOP;
    IF v_needed > 0 THEN
      v_missing := v_missing || jsonb_build_object(
        'equipment_type', v_item.equipment_type,
        'equipment_subtype', v_item.equipment_subtype,
        'missing_quantity', v_needed
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_missing) > 0 THEN
    UPDATE public.it_employee_kit_assignments SET status = 'parcial' WHERE id = v_assign_id;
  END IF;

  RETURN jsonb_build_object('assignment_id', v_assign_id, 'allocated', v_allocated, 'missing', v_missing);
END $$;

CREATE OR REPLACE VIEW public.it_equipment_by_employee AS
SELECT
  e.organization_id,
  e.responsible_employee_id AS employee_id,
  count(*) AS total_equipments,
  sum(coalesce(e.acquisition_value, 0)) AS total_acquisition_value,
  count(*) FILTER (WHERE e.home_office) AS home_office_count,
  min(e.next_replacement_review_date) AS next_review_date,
  jsonb_agg(jsonb_build_object(
    'id', e.id, 'name', e.name, 'type', e.equipment_type,
    'subtype', e.equipment_subtype, 'patrimonial_code', e.patrimonial_code,
    'value', e.acquisition_value, 'home_office', e.home_office
  ) ORDER BY e.equipment_type) AS equipments
FROM public.it_equipment e
WHERE e.responsible_employee_id IS NOT NULL
  AND e.status IN ('em_uso','disponivel')
GROUP BY e.organization_id, e.responsible_employee_id;

CREATE OR REPLACE FUNCTION public.it_get_lifecycle_alerts(p_org_id uuid)
RETURNS TABLE (
  equipment_id uuid, patrimonial_code text, name text,
  equipment_type it_equipment_type, responsible_employee_id uuid,
  acquisition_date date, useful_life_economic_months integer,
  end_of_life_date date, months_remaining integer,
  next_replacement_review_date date, review_overdue boolean, alert_level text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT e.*,
      (e.acquisition_date + (coalesce(e.useful_life_economic_months,48) || ' months')::interval)::date AS eol
    FROM public.it_equipment e
    WHERE e.organization_id = p_org_id
      AND is_org_member(auth.uid(), p_org_id)
      AND e.status NOT IN ('baixado','vendido','inativo')
  )
  SELECT
    id, patrimonial_code, name, equipment_type, responsible_employee_id,
    acquisition_date, useful_life_economic_months, eol,
    GREATEST(0, ((date_part('year', age(eol, current_date)) * 12)
      + date_part('month', age(eol, current_date)))::int) AS months_remaining,
    next_replacement_review_date,
    (next_replacement_review_date IS NOT NULL AND next_replacement_review_date < current_date),
    CASE
      WHEN acquisition_date IS NULL THEN 'unknown'
      WHEN eol < current_date THEN 'expired'
      WHEN eol < (current_date + interval '6 months') THEN 'critical'
      WHEN eol < (current_date + interval '12 months') THEN 'warning'
      ELSE 'ok'
    END
  FROM base;
$$;
