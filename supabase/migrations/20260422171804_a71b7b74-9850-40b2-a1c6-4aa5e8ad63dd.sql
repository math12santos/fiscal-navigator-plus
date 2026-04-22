-- Vinculação entre desligamentos planejados (hr_planning_items) e rescisões reais (employee_terminations)
ALTER TABLE public.employee_terminations
  ADD COLUMN IF NOT EXISTS hr_planning_item_id uuid REFERENCES public.hr_planning_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employee_terminations_hr_planning_item_id
  ON public.employee_terminations(hr_planning_item_id);

COMMENT ON COLUMN public.employee_terminations.hr_planning_item_id IS
  'Referência opcional ao item de Planejamento de RH (hr_planning_items) que originou esta rescisão. Permite fechar o ciclo planejamento → execução.';