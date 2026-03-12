ALTER TABLE public.bank_accounts 
  ADD COLUMN IF NOT EXISTS saldo_atual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_credito numeric DEFAULT 0;