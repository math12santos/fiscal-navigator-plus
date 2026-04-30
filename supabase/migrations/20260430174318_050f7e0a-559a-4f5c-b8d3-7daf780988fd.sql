-- 1) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.cashflow_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashflow_entry_id UUID,
  organization_id UUID,
  action TEXT NOT NULL CHECK (action IN ('update','delete')),
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before_data JSONB,
  after_data JSONB,
  changed_fields TEXT[]
);

ALTER TABLE public.cashflow_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view audit log"
  ON public.cashflow_audit_log FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND (
      public.is_org_member(auth.uid(), organization_id)
      OR public.has_backoffice_org_access(organization_id)
    )
  );

-- Apenas o trigger insere; nunca via API
CREATE POLICY "No direct insert"
  ON public.cashflow_audit_log FOR INSERT
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_cashflow_audit_org_date
  ON public.cashflow_audit_log(organization_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_cashflow_audit_entry
  ON public.cashflow_audit_log(cashflow_entry_id);

-- 2) Função e trigger
CREATE OR REPLACE FUNCTION public.log_cashflow_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed TEXT[] := ARRAY[]::TEXT[];
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.cashflow_audit_log
      (cashflow_entry_id, organization_id, action, changed_by, before_data, after_data, changed_fields)
    VALUES (OLD.id, OLD.organization_id, 'delete', auth.uid(), to_jsonb(OLD), NULL, NULL);
    RETURN OLD;
  END IF;

  v_before := to_jsonb(OLD);
  v_after := to_jsonb(NEW);

  -- Detecta campos sensíveis alterados
  IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto THEN v_changed := array_append(v_changed, 'valor_previsto'); END IF;
  IF OLD.valor_realizado IS DISTINCT FROM NEW.valor_realizado THEN v_changed := array_append(v_changed, 'valor_realizado'); END IF;
  IF OLD.data_prevista IS DISTINCT FROM NEW.data_prevista THEN v_changed := array_append(v_changed, 'data_prevista'); END IF;
  IF OLD.data_realizada IS DISTINCT FROM NEW.data_realizada THEN v_changed := array_append(v_changed, 'data_realizada'); END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN v_changed := array_append(v_changed, 'status'); END IF;
  IF OLD.conta_bancaria_id IS DISTINCT FROM NEW.conta_bancaria_id THEN v_changed := array_append(v_changed, 'conta_bancaria_id'); END IF;
  IF OLD.entity_id IS DISTINCT FROM NEW.entity_id THEN v_changed := array_append(v_changed, 'entity_id'); END IF;
  IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN v_changed := array_append(v_changed, 'account_id'); END IF;
  IF OLD.cost_center_id IS DISTINCT FROM NEW.cost_center_id THEN v_changed := array_append(v_changed, 'cost_center_id'); END IF;

  IF array_length(v_changed, 1) IS NULL THEN
    RETURN NEW; -- nada relevante mudou
  END IF;

  INSERT INTO public.cashflow_audit_log
    (cashflow_entry_id, organization_id, action, changed_by, before_data, after_data, changed_fields)
  VALUES (NEW.id, NEW.organization_id, 'update', auth.uid(), v_before, v_after, v_changed);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashflow_audit ON public.cashflow_entries;
CREATE TRIGGER trg_cashflow_audit
AFTER UPDATE OR DELETE ON public.cashflow_entries
FOR EACH ROW EXECUTE FUNCTION public.log_cashflow_change();

-- 3) Índice de performance para auditoria saldo×conciliados
CREATE INDEX IF NOT EXISTS idx_cashflow_org_account_status
  ON public.cashflow_entries(organization_id, conta_bancaria_id, status)
  WHERE conta_bancaria_id IS NOT NULL;

-- 4) Marcar lançamentos pagos órfãos de conta bancária para revisão
UPDATE public.cashflow_entries
SET notes = COALESCE(notes || E'\n', '') || '[backfill-pendente] Conta bancária não vinculada'
WHERE conta_bancaria_id IS NULL
  AND status IN ('pago','recebido')
  AND (notes IS NULL OR notes NOT LIKE '%[backfill-pendente]%');