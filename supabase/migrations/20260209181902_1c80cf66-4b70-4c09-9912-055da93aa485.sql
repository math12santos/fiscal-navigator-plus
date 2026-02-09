
CREATE UNIQUE INDEX idx_products_org_code ON public.products (organization_id, code);
