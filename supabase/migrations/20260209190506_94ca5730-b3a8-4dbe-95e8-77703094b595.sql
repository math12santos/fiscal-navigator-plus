
-- Add product_id column to contracts referencing products table
ALTER TABLE public.contracts ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
CREATE INDEX idx_contracts_product_id ON public.contracts (product_id);
