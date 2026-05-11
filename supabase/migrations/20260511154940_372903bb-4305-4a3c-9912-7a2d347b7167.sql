
-- 1. Pending wizard flag on it_equipment
ALTER TABLE public.it_equipment
  ADD COLUMN IF NOT EXISTS pending_wizard boolean NOT NULL DEFAULT false;

-- 2. Helper: idempotently create a request + task for compras workflow
CREATE OR REPLACE FUNCTION public.fn_compras_ensure_workflow_task(
  p_org_id uuid,
  p_user_id uuid,
  p_assignee uuid,
  p_title text,
  p_description text,
  p_due date,
  p_priority text,
  p_ref_module text,
  p_ref_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
  v_task_id uuid;
  v_creator uuid := COALESCE(p_user_id, p_assignee);
BEGIN
  IF v_creator IS NULL THEN
    RETURN NULL; -- cannot create without an owner user
  END IF;

  -- Idempotent request lookup by reference_module+reference_id
  SELECT id INTO v_request_id
    FROM public.requests
   WHERE organization_id = p_org_id
     AND reference_module = p_ref_module
     AND reference_id = p_ref_id
   LIMIT 1;

  IF v_request_id IS NULL THEN
    INSERT INTO public.requests (
      organization_id, user_id, title, description,
      type, priority, status, assigned_to, due_date,
      reference_module, reference_id
    ) VALUES (
      p_org_id, v_creator, p_title, p_description,
      'operacional', COALESCE(p_priority, 'media'), 'aberta', p_assignee, p_due,
      p_ref_module, p_ref_id
    ) RETURNING id INTO v_request_id;
  END IF;

  -- Idempotent task: one open task per (request_id, title)
  SELECT id INTO v_task_id
    FROM public.request_tasks
   WHERE request_id = v_request_id AND title = p_title
   LIMIT 1;

  IF v_task_id IS NULL THEN
    INSERT INTO public.request_tasks (
      request_id, organization_id, title, assigned_to, due_date, created_by, status
    ) VALUES (
      v_request_id, p_org_id, p_title, p_assignee, p_due, v_creator, 'pendente'
    ) RETURNING id INTO v_task_id;
  END IF;

  RETURN v_task_id;
END;
$$;

-- 3. Trigger: PO confirmed -> task to confirm receipt
CREATE OR REPLACE FUNCTION public.fn_po_create_receipt_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier text;
BEGIN
  IF NEW.status NOT IN ('confirmado','enviado_ap') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT COALESCE(nome_fantasia, razao_social, 'fornecedor') INTO v_supplier
    FROM public.suppliers WHERE id = NEW.supplier_id;

  PERFORM public.fn_compras_ensure_workflow_task(
    NEW.organization_id,
    NEW.created_by,
    COALESCE(NEW.responsavel_user_id, NEW.created_by),
    'Confirmar recebimento — pedido ' || COALESCE(NEW.codigo, NEW.id::text),
    'Pedido de ' || COALESCE(v_supplier, 'fornecedor') ||
      ' aguarda confirmação de recebimento e lançamento da nota fiscal.',
    COALESCE(NEW.data_prevista_entrega, (now() + interval '7 days')::date),
    'media',
    'compras_recebimento',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_create_receipt_task ON public.purchase_orders;
CREATE TRIGGER trg_po_create_receipt_task
AFTER INSERT OR UPDATE OF status ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_po_create_receipt_task();

-- 4. Trigger: divergence open -> task; resolved -> close task
CREATE OR REPLACE FUNCTION public.fn_divergence_task_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_priority text;
  v_title text;
BEGIN
  SELECT po.codigo, po.created_by, po.responsavel_user_id
    INTO v_order
    FROM public.purchase_orders po WHERE po.id = NEW.order_id;

  v_title := 'Resolver divergência (' || NEW.tipo || ') — pedido ' || COALESCE(v_order.codigo, NEW.order_id::text);

  IF (TG_OP = 'INSERT' AND NEW.status = 'aberta')
     OR (TG_OP = 'UPDATE' AND OLD.status <> 'aberta' AND NEW.status = 'aberta') THEN
    v_priority := CASE NEW.severidade WHEN 'alta' THEN 'alta' WHEN 'baixa' THEN 'baixa' ELSE 'media' END;
    PERFORM public.fn_compras_ensure_workflow_task(
      NEW.organization_id,
      COALESCE(NEW.created_by, v_order.created_by),
      COALESCE(v_order.responsavel_user_id, v_order.created_by),
      v_title,
      'Divergência: ' || NEW.descricao,
      (now() + interval '3 days')::date,
      v_priority,
      'compras_divergencia',
      NEW.id
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> 'resolvida' AND NEW.status = 'resolvida' THEN
    UPDATE public.request_tasks rt
       SET status = 'concluida', updated_at = now()
     WHERE rt.request_id IN (
        SELECT id FROM public.requests
         WHERE reference_module = 'compras_divergencia' AND reference_id = NEW.id
     )
       AND rt.status <> 'concluida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_divergence_task_sync ON public.purchase_divergences;
CREATE TRIGGER trg_divergence_task_sync
AFTER INSERT OR UPDATE OF status ON public.purchase_divergences
FOR EACH ROW EXECUTE FUNCTION public.fn_divergence_task_sync();

-- 5. Trigger: equipment created from compras -> wizard task + pending flag
CREATE OR REPLACE FUNCTION public.fn_it_equipment_wizard_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number NOT LIKE 'PO:%' THEN
    RETURN NEW;
  END IF;
  -- Mark as pending wizard
  NEW.pending_wizard := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_it_equipment_wizard_flag ON public.it_equipment;
CREATE TRIGGER trg_it_equipment_wizard_flag
BEFORE INSERT ON public.it_equipment
FOR EACH ROW EXECUTE FUNCTION public.fn_it_equipment_wizard_task();

CREATE OR REPLACE FUNCTION public.fn_it_equipment_wizard_task_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pending_wizard IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.invoice_number IS NULL OR NEW.invoice_number NOT LIKE 'PO:%' THEN RETURN NEW; END IF;

  PERFORM public.fn_compras_ensure_workflow_task(
    NEW.organization_id,
    NEW.created_by,
    NEW.created_by,
    'Completar cadastro TI: ' || NEW.name,
    'Equipamento criado a partir de pedido de compra. Acesse o módulo TI para informar tipo, specs e atribuição.',
    (now() + interval '7 days')::date,
    'media',
    'ti_wizard_pendente',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_it_equipment_wizard_task ON public.it_equipment;
CREATE TRIGGER trg_it_equipment_wizard_task
AFTER INSERT ON public.it_equipment
FOR EACH ROW EXECUTE FUNCTION public.fn_it_equipment_wizard_task_after();
