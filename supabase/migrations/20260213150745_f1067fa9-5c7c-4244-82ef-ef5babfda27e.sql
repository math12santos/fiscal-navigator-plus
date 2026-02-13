
-- Add operation type (compra/venda) and sub-classification to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS operacao text DEFAULT 'compra';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS subtipo_operacao text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS rendimento_mensal_esperado numeric DEFAULT 0;
