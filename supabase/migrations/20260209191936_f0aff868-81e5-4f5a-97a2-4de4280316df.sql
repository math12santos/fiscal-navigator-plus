
CREATE TABLE public.contract_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  descricao text NOT NULL DEFAULT 'Parcela',
  numero integer NOT NULL DEFAULT 1,
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_installments_contract_id ON public.contract_installments(contract_id);

ALTER TABLE public.contract_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view installments"
ON public.contract_installments FOR SELECT
USING (
  (auth.uid() = user_id) OR
  ((organization_id IS NOT NULL) AND is_org_member(auth.uid(), organization_id))
);

CREATE POLICY "Org members can create installments"
ON public.contract_installments FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) AND
  ((organization_id IS NULL) OR is_org_member(auth.uid(), organization_id))
);

CREATE POLICY "Org members can update installments"
ON public.contract_installments FOR UPDATE
USING (
  (auth.uid() = user_id) OR
  ((organization_id IS NOT NULL) AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','member']))
);

CREATE POLICY "Org members can delete installments"
ON public.contract_installments FOR DELETE
USING (
  (auth.uid() = user_id) OR
  ((organization_id IS NOT NULL) AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']))
);
