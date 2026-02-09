
-- Tabela unificada de Fornecedores e Clientes
CREATE TABLE public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'fornecedor', -- fornecedor, cliente, ambos
  name text NOT NULL,
  document_type text DEFAULT 'CNPJ', -- CPF ou CNPJ
  document_number text,
  email text,
  phone text,
  contact_person text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip text,
  payment_condition text, -- ex: 30 dias, 30/60/90
  credit_limit numeric DEFAULT 0,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_pix text,
  notes text,
  tags text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, document_number)
);

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view entities" ON public.entities
  FOR SELECT USING (
    auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create entities" ON public.entities
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update entities" ON public.entities
  FOR UPDATE USING (
    auth.uid() = user_id OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','member']))
  );

CREATE POLICY "Org admins can delete entities" ON public.entities
  FOR DELETE USING (
    auth.uid() = user_id OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']))
  );

CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de Produtos/Serviços
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'produto', -- produto, servico
  unit text DEFAULT 'un', -- un, kg, hr, m2, etc
  unit_price numeric NOT NULL DEFAULT 0,
  category text,
  description text,
  ncm text,
  cest text,
  account_id uuid REFERENCES public.chart_of_accounts(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view products" ON public.products
  FOR SELECT USING (
    auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create products" ON public.products
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update products" ON public.products
  FOR UPDATE USING (
    auth.uid() = user_id OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','member']))
  );

CREATE POLICY "Org admins can delete products" ON public.products
  FOR DELETE USING (
    auth.uid() = user_id OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']))
  );

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
