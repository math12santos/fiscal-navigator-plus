ALTER TABLE bank_accounts 
  ADD COLUMN IF NOT EXISTS saldo_atualizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS saldo_atualizado_por UUID REFERENCES auth.users(id);