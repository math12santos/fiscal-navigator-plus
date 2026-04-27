-- Adicionar campos de contas contábeis padrão por tipo de despesa DP
ALTER TABLE public.dp_config
  ADD COLUMN IF NOT EXISTS default_account_salario uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_account_encargos uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_account_beneficios uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_account_rescisao uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dp_config_default_accounts
  ON public.dp_config (default_account_salario, default_account_encargos, default_account_beneficios, default_account_rescisao);