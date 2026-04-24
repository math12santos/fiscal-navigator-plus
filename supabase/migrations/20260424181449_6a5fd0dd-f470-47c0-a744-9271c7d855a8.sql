-- 1. Adiciona coluna category em dp_benefits
ALTER TABLE public.dp_benefits
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros';

-- Validação dos valores permitidos
ALTER TABLE public.dp_benefits
DROP CONSTRAINT IF EXISTS dp_benefits_category_check;

ALTER TABLE public.dp_benefits
ADD CONSTRAINT dp_benefits_category_check
CHECK (category IN ('vale_refeicao','vale_alimentacao','vale_transporte','plano_saude','bonus','comissao','outros'));

-- 2. Backfill: inferir categoria a partir do nome dos benefícios já cadastrados
UPDATE public.dp_benefits
SET category = CASE
  WHEN lower(name) ~ '(vale.?refei|refeic|vr\y|^vr$)' THEN 'vale_refeicao'
  WHEN lower(name) ~ '(vale.?aliment|aliment|va\y|^va$)' THEN 'vale_alimentacao'
  WHEN lower(name) ~ '(vale.?transp|transporte|vt\y|^vt$)' THEN 'vale_transporte'
  WHEN lower(name) ~ '(sa[uú]de|health|plano de sa)' THEN 'plano_saude'
  WHEN lower(name) ~ 'b[oô]nus' THEN 'bonus'
  WHEN lower(name) ~ 'comiss' THEN 'comissao'
  ELSE 'outros'
END
WHERE category = 'outros' OR category IS NULL;

-- 3. Trigger de validação: impede 2 benefícios ativos da mesma categoria por colaborador
CREATE OR REPLACE FUNCTION public.validate_unique_employee_benefit_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_category text;
  v_conflict_count int;
  v_conflict_name text;
BEGIN
  -- Apenas valida quando o vínculo está ativo
  IF NEW.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Descobre a categoria do benefício recém atribuído
  SELECT category INTO v_category
  FROM public.dp_benefits
  WHERE id = NEW.benefit_id;

  IF v_category IS NULL OR v_category = 'outros' THEN
    -- 'outros' é coringa: permite múltiplos
    RETURN NEW;
  END IF;

  -- Verifica conflito: mesmo employee, mesma categoria, outro vínculo ativo
  SELECT count(*), max(b.name)
  INTO v_conflict_count, v_conflict_name
  FROM public.employee_benefits eb
  JOIN public.dp_benefits b ON b.id = eb.benefit_id
  WHERE eb.employee_id = NEW.employee_id
    AND eb.active = true
    AND eb.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.category = v_category;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Colaborador já possui um benefício ativo da categoria % (%). Remova o existente antes de atribuir outro.',
      v_category, v_conflict_name
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unique_employee_benefit_category ON public.employee_benefits;

CREATE TRIGGER trg_unique_employee_benefit_category
BEFORE INSERT OR UPDATE ON public.employee_benefits
FOR EACH ROW
EXECUTE FUNCTION public.validate_unique_employee_benefit_category();

-- 4. Índice para acelerar a verificação de conflitos
CREATE INDEX IF NOT EXISTS idx_employee_benefits_employee_active
  ON public.employee_benefits(employee_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_dp_benefits_category
  ON public.dp_benefits(category);