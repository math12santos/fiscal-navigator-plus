
-- ============================================================
-- Phase 1: Add new columns to cashflow_entries
-- ============================================================
ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS tipo_despesa text,
  ADD COLUMN IF NOT EXISTS subcategoria_id uuid REFERENCES public.chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS valor_bruto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_juros_multa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competencia text,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS data_prevista_pagamento date,
  ADD COLUMN IF NOT EXISTS natureza_contabil text,
  ADD COLUMN IF NOT EXISTS impacto_fluxo_caixa boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS impacto_orcamento boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS afeta_caixa_no_vencimento boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS conta_contabil_ref text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid,
  ADD COLUMN IF NOT EXISTS num_parcelas integer,
  ADD COLUMN IF NOT EXISTS acordo_id uuid,
  ADD COLUMN IF NOT EXISTS conciliacao_id text,
  ADD COLUMN IF NOT EXISTS recorrencia text,
  ADD COLUMN IF NOT EXISTS tipo_documento text;

-- ============================================================
-- Phase 2: Create bank_accounts table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  banco text,
  agencia text,
  conta text,
  tipo_conta text DEFAULT 'corrente',
  pix_key text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select" ON public.bank_accounts FOR SELECT USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);
CREATE POLICY "bank_accounts_insert" ON public.bank_accounts FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
);
CREATE POLICY "bank_accounts_update" ON public.bank_accounts FOR UPDATE USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);
CREATE POLICY "bank_accounts_delete" ON public.bank_accounts FOR DELETE USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);

-- Add FK from cashflow_entries to bank_accounts
ALTER TABLE public.cashflow_entries
  ADD CONSTRAINT cashflow_entries_conta_bancaria_id_fkey
  FOREIGN KEY (conta_bancaria_id) REFERENCES public.bank_accounts(id);

-- ============================================================
-- Phase 3: Create payment_methods table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods_select" ON public.payment_methods FOR SELECT USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);
CREATE POLICY "payment_methods_insert" ON public.payment_methods FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
);
CREATE POLICY "payment_methods_update" ON public.payment_methods FOR UPDATE USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);
CREATE POLICY "payment_methods_delete" ON public.payment_methods FOR DELETE USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);

-- ============================================================
-- Phase 4: Create expense_cost_center_splits table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expense_cost_center_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashflow_entry_id uuid NOT NULL REFERENCES public.cashflow_entries(id) ON DELETE CASCADE,
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  percentual numeric DEFAULT 0,
  valor numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.expense_cost_center_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "splits_select" ON public.expense_cost_center_splits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.cashflow_entries ce
    WHERE ce.id = cashflow_entry_id
    AND (is_org_member(auth.uid(), ce.organization_id) OR has_backoffice_org_access(ce.organization_id))
  )
);
CREATE POLICY "splits_insert" ON public.expense_cost_center_splits FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cashflow_entries ce
    WHERE ce.id = cashflow_entry_id
    AND (is_org_member(auth.uid(), ce.organization_id) OR has_backoffice_org_access(ce.organization_id))
  )
);
CREATE POLICY "splits_update" ON public.expense_cost_center_splits FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.cashflow_entries ce
    WHERE ce.id = cashflow_entry_id
    AND (is_org_member(auth.uid(), ce.organization_id) OR has_backoffice_org_access(ce.organization_id))
  )
);
CREATE POLICY "splits_delete" ON public.expense_cost_center_splits FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.cashflow_entries ce
    WHERE ce.id = cashflow_entry_id
    AND (is_org_member(auth.uid(), ce.organization_id) OR has_backoffice_org_access(ce.organization_id))
  )
);

-- ============================================================
-- Phase 5: Create supplier_agreements table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  entity_id uuid REFERENCES public.entities(id),
  descricao text NOT NULL,
  valor_total numeric DEFAULT 0,
  status text DEFAULT 'ativo',
  data_acordo date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.supplier_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreements_select" ON public.supplier_agreements FOR SELECT USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);
CREATE POLICY "agreements_insert" ON public.supplier_agreements FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id))
);
CREATE POLICY "agreements_update" ON public.supplier_agreements FOR UPDATE USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);
CREATE POLICY "agreements_delete" ON public.supplier_agreements FOR DELETE USING (
  is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id)
);

-- Add FK from cashflow_entries to supplier_agreements
ALTER TABLE public.cashflow_entries
  ADD CONSTRAINT cashflow_entries_acordo_id_fkey
  FOREIGN KEY (acordo_id) REFERENCES public.supplier_agreements(id);
