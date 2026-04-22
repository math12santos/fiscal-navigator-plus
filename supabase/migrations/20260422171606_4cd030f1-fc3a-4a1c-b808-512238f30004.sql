-- Adicionar contract_type em employee_terminations para auditoria histórica
-- Snapshot do regime do colaborador no momento da rescisão (CLT, PJ, estagiario, jovem_aprendiz, etc.)
ALTER TABLE public.employee_terminations
ADD COLUMN IF NOT EXISTS contract_type TEXT;

COMMENT ON COLUMN public.employee_terminations.contract_type IS
  'Snapshot imutável do regime de contratação do colaborador na data da rescisão (clt, pj, estagiario, jovem_aprendiz, autonomo). Garante auditoria histórica mesmo que o regime do colaborador mude posteriormente.';

-- Backfill: preencher registros existentes com o contract_type atual do colaborador
UPDATE public.employee_terminations et
SET contract_type = e.contract_type
FROM public.employees e
WHERE et.employee_id = e.id
  AND et.contract_type IS NULL;

-- Trigger para snapshot automático ao criar uma rescisão (caso o front não envie)
CREATE OR REPLACE FUNCTION public.set_termination_contract_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_type IS NULL THEN
    SELECT contract_type INTO NEW.contract_type
    FROM public.employees
    WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_termination_contract_type ON public.employee_terminations;
CREATE TRIGGER trg_set_termination_contract_type
BEFORE INSERT ON public.employee_terminations
FOR EACH ROW
EXECUTE FUNCTION public.set_termination_contract_type();