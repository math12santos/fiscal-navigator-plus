
-- Table: grouping_macrogroups
CREATE TABLE public.grouping_macrogroups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Layers',
  color TEXT DEFAULT '#6366f1',
  order_index INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grouping_macrogroups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view macrogroups"
  ON public.grouping_macrogroups FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert macrogroups"
  ON public.grouping_macrogroups FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update macrogroups"
  ON public.grouping_macrogroups FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete macrogroups"
  ON public.grouping_macrogroups FOR DELETE
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

-- Table: grouping_groups
CREATE TABLE public.grouping_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  macrogroup_id UUID REFERENCES public.grouping_macrogroups(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grouping_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view groups"
  ON public.grouping_groups FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert groups"
  ON public.grouping_groups FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update groups"
  ON public.grouping_groups FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete groups"
  ON public.grouping_groups FOR DELETE
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

-- Alter grouping_rules: add group_id, operator, match_keyword
ALTER TABLE public.grouping_rules
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.grouping_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator TEXT NOT NULL DEFAULT 'equals',
  ADD COLUMN IF NOT EXISTS match_keyword TEXT;

-- Triggers for updated_at
CREATE TRIGGER update_grouping_macrogroups_updated_at
  BEFORE UPDATE ON public.grouping_macrogroups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grouping_groups_updated_at
  BEFORE UPDATE ON public.grouping_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
