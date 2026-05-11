ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS saldo_ofx numeric,
  ADD COLUMN IF NOT EXISTS saldo_ofx_data date,
  ADD COLUMN IF NOT EXISTS saldo_ofx_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS saldo_ofx_import_id uuid;