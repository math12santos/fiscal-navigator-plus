-- Histórico mensal de maturidade por setor
CREATE TABLE public.sector_onboarding_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  period_month DATE NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  completeness_score NUMERIC NOT NULL DEFAULT 0,
  freshness_score NUMERIC NOT NULL DEFAULT 0,
  routines_score NUMERIC NOT NULL DEFAULT 0,
  maturity_label TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sector_onboarding_history_uniq UNIQUE (organization_id, sector, period_month)
);

CREATE INDEX idx_sector_onboarding_history_org_sector ON public.sector_onboarding_history(organization_id, sector);
CREATE INDEX idx_sector_onboarding_history_period ON public.sector_onboarding_history(period_month);

ALTER TABLE public.sector_onboarding_history ENABLE ROW LEVEL SECURITY;

-- Org members podem ler o próprio histórico
CREATE POLICY "Org members can view sector onboarding history"
ON public.sector_onboarding_history
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

-- Backoffice tem acesso total
CREATE POLICY "Backoffice can view sector onboarding history"
ON public.sector_onboarding_history
FOR SELECT
USING (has_backoffice_org_access(organization_id));

CREATE POLICY "Backoffice can manage sector onboarding history"
ON public.sector_onboarding_history
FOR ALL
USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

-- Org members também podem inserir/atualizar (para backfill defensivo do mês corrente)
CREATE POLICY "Org members can upsert sector onboarding history"
ON public.sector_onboarding_history
FOR INSERT
WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update sector onboarding history"
ON public.sector_onboarding_history
FOR UPDATE
USING (is_org_member(auth.uid(), organization_id));

-- Meta de cumprimento de rotinas (usada pelas notificações)
ALTER TABLE public.dp_config
ADD COLUMN IF NOT EXISTS meta_rotinas_pct NUMERIC NOT NULL DEFAULT 0.85;