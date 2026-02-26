
-- =============================================
-- CRM CLIENTS
-- =============================================
CREATE TABLE public.crm_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  name text NOT NULL,
  document_number text,
  segment text,
  responsible text,
  status text NOT NULL DEFAULT 'prospect',
  origin text,
  score integer NOT NULL DEFAULT 50,
  health_score integer NOT NULL DEFAULT 50,
  engagement text NOT NULL DEFAULT 'medio',
  churn_risk text NOT NULL DEFAULT 'baixo',
  mrr numeric NOT NULL DEFAULT 0,
  estimated_margin numeric NOT NULL DEFAULT 0,
  last_contact_at timestamp with time zone,
  next_action_at timestamp with time zone,
  next_action_type text,
  next_action_description text,
  contract_start_date date,
  contract_renewal_date date,
  notes text,
  tags text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view crm clients"
  ON public.crm_clients FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create crm clients"
  ON public.crm_clients FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update crm clients"
  ON public.crm_clients FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete crm clients"
  ON public.crm_clients FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

CREATE TRIGGER update_crm_clients_updated_at
  BEFORE UPDATE ON public.crm_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CRM PIPELINE STAGES
-- =============================================
CREATE TABLE public.crm_pipeline_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  probability numeric NOT NULL DEFAULT 0,
  avg_days integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view pipeline stages"
  ON public.crm_pipeline_stages FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create pipeline stages"
  ON public.crm_pipeline_stages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update pipeline stages"
  ON public.crm_pipeline_stages FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete pipeline stages"
  ON public.crm_pipeline_stages FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- =============================================
-- CRM OPPORTUNITIES
-- =============================================
CREATE TABLE public.crm_opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_pipeline_stages(id) ON DELETE RESTRICT,
  title text NOT NULL,
  estimated_value numeric NOT NULL DEFAULT 0,
  estimated_close_date date,
  contract_type text DEFAULT 'venda',
  recurrence text NOT NULL DEFAULT 'mensal',
  responsible text,
  notes text,
  won_at timestamp with time zone,
  lost_at timestamp with time zone,
  lost_reason text,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view crm opportunities"
  ON public.crm_opportunities FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create crm opportunities"
  ON public.crm_opportunities FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update crm opportunities"
  ON public.crm_opportunities FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete crm opportunities"
  ON public.crm_opportunities FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

CREATE TRIGGER update_crm_opportunities_updated_at
  BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CRM ACTIVITIES
-- =============================================
CREATE TABLE public.crm_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'nota',
  description text NOT NULL,
  scheduled_at timestamp with time zone,
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view crm activities"
  ON public.crm_activities FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create crm activities"
  ON public.crm_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update crm activities"
  ON public.crm_activities FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete crm activities"
  ON public.crm_activities FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- =============================================
-- SEED DEFAULT PIPELINE STAGES ON ORG CREATION
-- =============================================
CREATE OR REPLACE FUNCTION public.seed_default_pipeline_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.crm_pipeline_stages (organization_id, user_id, name, order_index, probability, avg_days, color, is_won, is_lost)
  VALUES
    (NEW.id, NEW.created_by, 'Lead Qualificado', 1, 10, 7, '#6366f1', false, false),
    (NEW.id, NEW.created_by, 'Contato Inicial', 2, 20, 5, '#8b5cf6', false, false),
    (NEW.id, NEW.created_by, 'Proposta Enviada', 3, 40, 10, '#a855f7', false, false),
    (NEW.id, NEW.created_by, 'Negociação', 4, 60, 15, '#d946ef', false, false),
    (NEW.id, NEW.created_by, 'Fechamento', 5, 80, 5, '#ec4899', false, false),
    (NEW.id, NEW.created_by, 'Ganho', 6, 100, 0, '#22c55e', true, false),
    (NEW.id, NEW.created_by, 'Perdido', 7, 0, 0, '#ef4444', false, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_pipeline_stages_on_org
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_pipeline_stages();
