
-- Tabela principal de fluxo de caixa (modelo híbrido)
-- Lançamentos podem ser: projeção de contrato ou registro manual/realizado
CREATE TABLE public.cashflow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  
  -- Vínculo com contrato (null = lançamento manual)
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  contract_installment_id uuid REFERENCES public.contract_installments(id) ON DELETE SET NULL,
  
  -- Classificação
  tipo text NOT NULL DEFAULT 'saida', -- 'entrada' ou 'saida'
  categoria text, -- ex: 'aluguel', 'salário', 'serviço', 'produto'
  descricao text NOT NULL,
  
  -- Valores
  valor_previsto numeric NOT NULL DEFAULT 0,
  valor_realizado numeric, -- null = ainda não materializado
  
  -- Datas
  data_prevista date NOT NULL,
  data_realizada date, -- null = ainda não pago/recebido
  
  -- Status
  status text NOT NULL DEFAULT 'previsto', -- 'previsto', 'confirmado', 'pago', 'cancelado'
  
  -- Classificações contábeis
  account_id uuid REFERENCES public.chart_of_accounts(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  entity_id uuid REFERENCES public.entities(id),
  
  -- Metadata
  notes text,
  source text NOT NULL DEFAULT 'manual', -- 'manual', 'contrato', 'importacao'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_cashflow_org ON public.cashflow_entries(organization_id);
CREATE INDEX idx_cashflow_data_prevista ON public.cashflow_entries(data_prevista);
CREATE INDEX idx_cashflow_contract ON public.cashflow_entries(contract_id);
CREATE INDEX idx_cashflow_status ON public.cashflow_entries(status);

-- Trigger para updated_at
CREATE TRIGGER update_cashflow_entries_updated_at
  BEFORE UPDATE ON public.cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cashflow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view cashflow"
  ON public.cashflow_entries FOR SELECT
  USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can create cashflow"
  ON public.cashflow_entries FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id) AND 
    ((organization_id IS NULL) OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Org members can update cashflow"
  ON public.cashflow_entries FOR UPDATE
  USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Org admins can delete cashflow"
  ON public.cashflow_entries FOR DELETE
  USING (
    (auth.uid() = user_id) OR 
    (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']))
  );
