
-- =============================================
-- MÓDULO DE CONTRATOS: Migração completa 3.1–3.8
-- =============================================

-- 3.1 Recorrência Financeira
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tipo_recorrencia text NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS intervalo_personalizado integer,
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS prazo_indeterminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_base numeric NOT NULL DEFAULT 0;

-- 3.2 Reajustes Automáticos
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tipo_reajuste text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS indice_reajuste text,
  ADD COLUMN IF NOT EXISTS percentual_reajuste numeric,
  ADD COLUMN IF NOT EXISTS periodicidade_reajuste text DEFAULT 'anual',
  ADD COLUMN IF NOT EXISTS proximo_reajuste date;

-- 3.6 Classificações Financeiras
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS natureza_financeira text DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS impacto_resultado text DEFAULT 'custo',
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id);

-- 3.7 Governança
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS responsavel_interno text,
  ADD COLUMN IF NOT EXISTS area_responsavel text,
  ADD COLUMN IF NOT EXISTS sla_revisao_dias integer;

-- =============================================
-- TABELA: contract_adjustments (3.2 Histórico de Reajustes)
-- =============================================
CREATE TABLE public.contract_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  data_reajuste date NOT NULL,
  tipo text NOT NULL,
  indice_aplicado text,
  percentual numeric NOT NULL,
  valor_anterior numeric NOT NULL,
  valor_novo numeric NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view adjustments"
  ON public.contract_adjustments FOR SELECT
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Org members can create adjustments"
  ON public.contract_adjustments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Org members can delete adjustments"
  ON public.contract_adjustments FOR DELETE
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])));

-- =============================================
-- TABELA: contract_documents (3.8 Documentos)
-- =============================================
CREATE TABLE public.contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'contrato',
  version integer NOT NULL DEFAULT 1,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view documents"
  ON public.contract_documents FOR SELECT
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Org members can create documents"
  ON public.contract_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Org members can delete documents"
  ON public.contract_documents FOR DELETE
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])));

-- =============================================
-- Storage bucket para documentos de contratos
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-documents', 'contract-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members can view contract files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-documents');

CREATE POLICY "Authenticated users can upload contract files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contract-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own contract files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contract-documents' AND auth.role() = 'authenticated');
