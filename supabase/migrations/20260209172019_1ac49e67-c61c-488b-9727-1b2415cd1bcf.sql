ALTER TABLE public.contracts ADD COLUMN dia_vencimento integer;

-- Add check constraint via trigger for validation
CREATE OR REPLACE FUNCTION public.validate_dia_vencimento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.dia_vencimento IS NOT NULL AND (NEW.dia_vencimento < 1 OR NEW.dia_vencimento > 31) THEN
    RAISE EXCEPTION 'dia_vencimento must be between 1 and 31';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dia_vencimento_trigger
BEFORE INSERT OR UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.validate_dia_vencimento();