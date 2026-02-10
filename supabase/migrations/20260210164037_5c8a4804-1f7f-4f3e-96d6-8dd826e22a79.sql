
-- Add finalidade field to contracts (for supplier contracts: revenda, uso_proprio, ambos)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS finalidade text;

-- Add depreciation fields to products (for imobilizado type)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vida_util_fiscal_anos integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vida_util_economica_anos integer;
