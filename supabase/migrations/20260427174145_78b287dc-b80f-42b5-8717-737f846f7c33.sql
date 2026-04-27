-- Tabela de metas de maturidade configuráveis por organização e setor
CREATE TABLE public.sector_maturity_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sector text NOT NULL CHECK (sector IN ('dp','financeiro')),
  routines_target_pct numeric NOT NULL DEFAULT 0.85 CHECK (routines_target_pct >= 0 AND routines_target_pct <= 1),
  routines_overdue_tolerance_pct numeric NOT NULL DEFAULT 0.10 CHECK (routines_overdue_tolerance_pct >= 0 AND routines_overdue_tolerance_pct <= 1),
  reconciliation_target_pct numeric NOT NULL DEFAULT 0.90 CHECK (reconciliation_target_pct >= 0 AND reconciliation_target_pct <= 1),
  classification_target_pct numeric NOT NULL DEFAULT 0.95 CHECK (classification_target_pct >= 0 AND classification_target_pct <= 1),
  bank_freshness_days integer NOT NULL DEFAULT 7 CHECK (bank_freshness_days >= 1 AND bank_freshness_days <= 90),
  overdue_critical_days integer NOT NULL DEFAULT 30 CHECK (overdue_critical_days >= 1 AND overdue_critical_days <= 365),
  overdue_max_count integer NOT NULL DEFAULT 10 CHECK (overdue_max_count >= 1 AND overdue_max_count <= 1000),
  documents_required text[] NOT NULL DEFAULT ARRAY['contrato','rg','cpf']::text[],
  payroll_close_required boolean NOT NULL DEFAULT true,
  period_close_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sector)
);

CREATE INDEX idx_sector_maturity_targets_org_sector ON public.sector_maturity_targets(organization_id, sector);

ALTER TABLE public.sector_maturity_targets ENABLE ROW LEVEL SECURITY;

-- Leitura: membros da organização ou backoffice
CREATE POLICY "sector_maturity_targets_select"
ON public.sector_maturity_targets
FOR SELECT
TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  OR has_backoffice_org_access(organization_id)
);

-- Insert: owner/admin da org, master ou backoffice
CREATE POLICY "sector_maturity_targets_insert"
ON public.sector_maturity_targets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'master')
  OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
  OR has_backoffice_role(ARRAY['master','backoffice_admin'])
);

-- Update: idem insert
CREATE POLICY "sector_maturity_targets_update"
ON public.sector_maturity_targets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'master')
  OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
  OR has_backoffice_role(ARRAY['master','backoffice_admin'])
)
WITH CHECK (
  has_role(auth.uid(), 'master')
  OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
  OR has_backoffice_role(ARRAY['master','backoffice_admin'])
);

-- Delete: master ou backoffice_admin
CREATE POLICY "sector_maturity_targets_delete"
ON public.sector_maturity_targets
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'master')
  OR has_backoffice_role(ARRAY['master','backoffice_admin'])
);

-- Trigger updated_at
CREATE TRIGGER trg_sector_maturity_targets_updated
BEFORE UPDATE ON public.sector_maturity_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill DP a partir de dp_config.meta_rotinas_pct (quando existir)
INSERT INTO public.sector_maturity_targets (organization_id, sector, routines_target_pct)
SELECT organization_id, 'dp', meta_rotinas_pct
FROM public.dp_config
WHERE meta_rotinas_pct IS NOT NULL
ON CONFLICT (organization_id, sector) DO NOTHING;