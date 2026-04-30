-- Fase 3: Service Desk com SLA real
-- 1) Garantir colunas em it_tickets para tracking de SLA e workflow
ALTER TABLE public.it_tickets
  ADD COLUMN IF NOT EXISTS sla_policy_id UUID REFERENCES public.it_sla_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mtta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS mttr_minutes INTEGER;

-- 2) Trigger: ao inserir ticket, escolher SLA mais específico (categoria+prioridade > prioridade) e calcular vencimentos
CREATE OR REPLACE FUNCTION public.it_apply_sla_to_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_policy RECORD;
BEGIN
  -- Match: prioridade obrigatória, categoria opcional (ranking: categoria específica primeiro)
  SELECT * INTO v_policy
  FROM public.it_sla_policies
  WHERE organization_id = NEW.organization_id
    AND active = true
    AND priority = NEW.priority
    AND (category IS NULL OR category = NEW.category)
  ORDER BY (category IS NOT NULL) DESC, created_at ASC
  LIMIT 1;

  IF v_policy.id IS NOT NULL THEN
    NEW.sla_policy_id := v_policy.id;
    NEW.sla_response_due_at := COALESCE(NEW.created_at, now()) + (v_policy.response_time_hours || ' hours')::interval;
    NEW.sla_resolution_due_at := COALESCE(NEW.created_at, now()) + (v_policy.resolution_time_hours || ' hours')::interval;
    IF NEW.due_at IS NULL THEN
      NEW.due_at := NEW.sla_resolution_due_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_it_apply_sla ON public.it_tickets;
CREATE TRIGGER trg_it_apply_sla
  BEFORE INSERT ON public.it_tickets
  FOR EACH ROW EXECUTE FUNCTION public.it_apply_sla_to_ticket();

-- 3) Trigger: ao atualizar status, marcar first_response_at, resolved_at e calcular MTTA/MTTR
CREATE OR REPLACE FUNCTION public.it_track_ticket_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Primeira saída de "aberto" → primeiro atendimento
  IF NEW.first_response_at IS NULL
     AND OLD.status = 'aberto'
     AND NEW.status <> 'aberto' THEN
    NEW.first_response_at := now();
    NEW.mtta_minutes := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 60;
  END IF;

  -- Resolução
  IF NEW.resolved_at IS NULL
     AND NEW.status IN ('resolvido', 'cancelado')
     AND OLD.status NOT IN ('resolvido', 'cancelado') THEN
    NEW.resolved_at := now();
    NEW.mttr_minutes := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 60;
  END IF;

  -- Reabertura: limpa resolved_at
  IF NEW.status NOT IN ('resolvido', 'cancelado')
     AND OLD.status IN ('resolvido', 'cancelado') THEN
    NEW.resolved_at := NULL;
    NEW.mttr_minutes := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_it_track_lifecycle ON public.it_tickets;
CREATE TRIGGER trg_it_track_lifecycle
  BEFORE UPDATE ON public.it_tickets
  FOR EACH ROW EXECUTE FUNCTION public.it_track_ticket_lifecycle();

-- 4) Index para queries de SLA breach
CREATE INDEX IF NOT EXISTS idx_it_tickets_sla_response ON public.it_tickets(sla_response_due_at) WHERE first_response_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_it_tickets_sla_resolution ON public.it_tickets(sla_resolution_due_at) WHERE resolved_at IS NULL;