ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_digit text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS payment_holder_name text,
  ADD COLUMN IF NOT EXISTS payment_holder_document text,
  ADD COLUMN IF NOT EXISTS payment_notes text;