ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS data_assinatura DATE;

COMMENT ON COLUMN public.cashflow_entries.data_assinatura IS
  'Data de assinatura do contrato comercial associado (usado em Contas a Receber).';