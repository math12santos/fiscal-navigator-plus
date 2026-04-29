-- Add tipo and observacoes fields
ALTER TABLE public.employee_vacations
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'gozo',
  ADD COLUMN IF NOT EXISTS observacoes text;

-- CLT validation: abono (venda) <= 10 days, total <= 30
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_vacations_dias_vendidos_max'
  ) THEN
    ALTER TABLE public.employee_vacations
      ADD CONSTRAINT employee_vacations_dias_vendidos_max
      CHECK (COALESCE(dias_vendidos, 0) <= 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_vacations_dias_total_max'
  ) THEN
    ALTER TABLE public.employee_vacations
      ADD CONSTRAINT employee_vacations_dias_total_max
      CHECK (COALESCE(dias_gozados, 0) + COALESCE(dias_vendidos, 0) <= 30);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_vacations_tipo_check'
  ) THEN
    ALTER TABLE public.employee_vacations
      ADD CONSTRAINT employee_vacations_tipo_check
      CHECK (tipo IN ('gozo', 'abono_venda', 'programado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employee_vacations_emp_periodo
  ON public.employee_vacations (organization_id, employee_id, periodo_aquisitivo_inicio);