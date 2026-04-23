-- ============================================================================
-- FASE 2 — DOSSIÊ E CICLO DE VIDA DO COLABORADOR
-- 1) employee_documents (metadados; arquivos no bucket privado employee-documents)
-- 2) payroll_events (eventos variáveis de folha)
-- 3) bucket employee-documents + policies de Storage
-- ============================================================================

-- ---------- 1) employee_documents ----------
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'contrato','rg','cpf','ctps','exame_admissional','exame_periodico',
    'aso','comprovante_endereco','outros'
  )),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- storage path relative to bucket
  file_size BIGINT,
  mime_type TEXT,
  expires_at DATE, -- usado para alertas (exames)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_org ON public.employee_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expires ON public.employee_documents(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ed_select_org_members"
  ON public.employee_documents FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "ed_insert_org_members"
  ON public.employee_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "ed_update_org_members"
  ON public.employee_documents FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "ed_delete_org_members"
  ON public.employee_documents FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 2) payroll_events ----------
CREATE TABLE IF NOT EXISTS public.payroll_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  payroll_run_id UUID, -- pode ser nulo até ser vinculado à folha do mês
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'hora_extra_50','hora_extra_100','adicional_noturno',
    'falta','atraso','bonus','comissao_variavel',
    'desconto_pontual','adiantamento','vale','outros_provento','outros_desconto'
  )),
  signal TEXT NOT NULL CHECK (signal IN ('provento','desconto')),
  description TEXT NOT NULL,
  reference TEXT, -- ex: "10h", "2 dias"
  quantity NUMERIC,
  unit_value NUMERIC,
  value NUMERIC NOT NULL DEFAULT 0,
  reference_month DATE, -- mês de competência
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_events_employee ON public.payroll_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_events_run ON public.payroll_events(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_events_org_month ON public.payroll_events(organization_id, reference_month);

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_select_org_members"
  ON public.payroll_events FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_backoffice_org_access(organization_id));

CREATE POLICY "pe_insert_org_members"
  ON public.payroll_events FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "pe_update_org_members"
  ON public.payroll_events FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "pe_delete_org_members"
  ON public.payroll_events FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_payroll_events_updated_at
  BEFORE UPDATE ON public.payroll_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3) Storage bucket employee-documents ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Path padrão: <organization_id>/<employee_id>/<filename>
-- Acesso: membros da organização (folder name 1 = organization_id)

CREATE POLICY "ed_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'employee-documents'
    AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "ed_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "ed_storage_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'employee-documents'
    AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "ed_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'employee-documents'
    AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ---------- 4) Reajuste em massa: marcador no histórico ----------
-- employee_compensations já existe; só garantir coluna 'recurrence' aceita 'dissidio' e adicionar índice.
CREATE INDEX IF NOT EXISTS idx_employee_compensations_employee_created
  ON public.employee_compensations(employee_id, created_at DESC);