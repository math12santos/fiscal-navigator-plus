-- Deduplicate existing payroll_items keeping the most recent per (payroll_run_id, employee_id)
DELETE FROM public.payroll_items a
USING public.payroll_items b
WHERE a.payroll_run_id = b.payroll_run_id
  AND a.employee_id = b.employee_id
  AND a.created_at < b.created_at;

DELETE FROM public.payroll_items a
USING public.payroll_items b
WHERE a.payroll_run_id = b.payroll_run_id
  AND a.employee_id = b.employee_id
  AND a.created_at = b.created_at
  AND a.id < b.id;

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.payroll_items
  ADD CONSTRAINT payroll_items_run_employee_unique
  UNIQUE (payroll_run_id, employee_id);