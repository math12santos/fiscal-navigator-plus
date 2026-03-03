
-- Table: requests
CREATE TABLE public.requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'operacional',
  area_responsavel text,
  assigned_to uuid,
  description text,
  priority text NOT NULL DEFAULT 'media',
  due_date date,
  cost_center_id uuid REFERENCES public.cost_centers(id),
  reference_module text,
  reference_id uuid,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: request_tasks
CREATE TABLE public.request_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Tarefa',
  assigned_to uuid,
  status text NOT NULL DEFAULT 'pendente',
  due_date date,
  created_by uuid NOT NULL,
  executed_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: request_comments
CREATE TABLE public.request_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'comment',
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: request_attachments
CREATE TABLE public.request_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  priority text NOT NULL DEFAULT 'media',
  reference_type text,
  reference_id uuid,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for requests
CREATE POLICY "Org members can view requests" ON public.requests FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create requests" ON public.requests FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update requests" ON public.requests FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete requests" ON public.requests FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- RLS policies for request_tasks
CREATE POLICY "Org members can view request tasks" ON public.request_tasks FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create request tasks" ON public.request_tasks FOR INSERT WITH CHECK (auth.uid() = created_by AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update request tasks" ON public.request_tasks FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete request tasks" ON public.request_tasks FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- RLS policies for request_comments
CREATE POLICY "Org members can view request comments" ON public.request_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND is_org_member(auth.uid(), r.organization_id))
);
CREATE POLICY "Users can create request comments" ON public.request_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for request_attachments
CREATE POLICY "Org members can view request attachments" ON public.request_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND is_org_member(auth.uid(), r.organization_id))
);
CREATE POLICY "Users can create request attachments" ON public.request_attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own attachments" ON public.request_attachments FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for notifications (only the recipient can see)
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Org members can create notifications" ON public.notifications FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Updated_at triggers
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_request_tasks_updated_at BEFORE UPDATE ON public.request_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
