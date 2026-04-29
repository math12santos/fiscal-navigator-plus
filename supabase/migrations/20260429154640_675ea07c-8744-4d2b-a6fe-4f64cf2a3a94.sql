-- 1. Função que garante competencia preenchida (formato YYYY-MM, baseado em data_prevista)
CREATE OR REPLACE FUNCTION public.set_cashflow_competencia_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Se competencia veio vazia/null, derivar de data_prevista
  IF (NEW.competencia IS NULL OR length(trim(NEW.competencia)) = 0)
     AND NEW.data_prevista IS NOT NULL THEN
    NEW.competencia := to_char(NEW.data_prevista, 'YYYY-MM');
  END IF;

  -- Normalizar formatos comuns para YYYY-MM
  IF NEW.competencia IS NOT NULL THEN
    -- "MM/YYYY" → "YYYY-MM"
    IF NEW.competencia ~ '^\d{2}/\d{4}$' THEN
      NEW.competencia := substring(NEW.competencia from 4 for 4) || '-' || substring(NEW.competencia from 1 for 2);
    -- "YYYY-MM-DD" → "YYYY-MM"
    ELSIF NEW.competencia ~ '^\d{4}-\d{2}-\d{2}' THEN
      NEW.competencia := substring(NEW.competencia from 1 for 7);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_cashflow_set_competencia ON public.cashflow_entries;
CREATE TRIGGER trg_cashflow_set_competencia
  BEFORE INSERT OR UPDATE OF competencia, data_prevista
  ON public.cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cashflow_competencia_default();

-- 3. Backfill histórico: linhas sem competencia recebem mês de data_prevista
UPDATE public.cashflow_entries
SET competencia = to_char(data_prevista, 'YYYY-MM')
WHERE (competencia IS NULL OR length(trim(competencia)) = 0)
  AND data_prevista IS NOT NULL;

-- 4. Normalizar competências em formato divergente (MM/YYYY → YYYY-MM)
UPDATE public.cashflow_entries
SET competencia = substring(competencia from 4 for 4) || '-' || substring(competencia from 1 for 2)
WHERE competencia ~ '^\d{2}/\d{4}$';

-- 5. Normalizar competências em data completa (YYYY-MM-DD → YYYY-MM)
UPDATE public.cashflow_entries
SET competencia = substring(competencia from 1 for 7)
WHERE competencia ~ '^\d{4}-\d{2}-\d{2}';

-- 6. Índice para agregações por competência (PMP/PMR e DRE)
CREATE INDEX IF NOT EXISTS idx_cashflow_competencia
  ON public.cashflow_entries(organization_id, tipo, competencia);

-- 7. Índice para PMP/PMR (busca contas pagas/recebidas por janela)
CREATE INDEX IF NOT EXISTS idx_cashflow_data_realizada
  ON public.cashflow_entries(organization_id, tipo, data_realizada)
  WHERE data_realizada IS NOT NULL;