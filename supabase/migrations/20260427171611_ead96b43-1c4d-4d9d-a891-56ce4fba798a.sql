ALTER TABLE public.dp_config
  ADD COLUMN IF NOT EXISTS advance_enabled       boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advance_pct           numeric  NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS advance_payment_day   smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS salary_payment_day    smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS salary_payment_basis  text     NOT NULL DEFAULT 'business_day',
  ADD COLUMN IF NOT EXISTS inss_due_day          smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS fgts_due_day          smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS irrf_due_day          smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS benefits_payment_day  smallint NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS health_payment_day    smallint NOT NULL DEFAULT 10;

ALTER TABLE public.dp_config
  DROP CONSTRAINT IF EXISTS dp_config_salary_payment_basis_check;
ALTER TABLE public.dp_config
  ADD CONSTRAINT dp_config_salary_payment_basis_check
  CHECK (salary_payment_basis IN ('business_day','calendar_day'));

ALTER TABLE public.dp_config
  DROP CONSTRAINT IF EXISTS dp_config_advance_pct_check;
ALTER TABLE public.dp_config
  ADD CONSTRAINT dp_config_advance_pct_check
  CHECK (advance_pct >= 0 AND advance_pct <= 100);