-- Create kpi_period_presets table
CREATE TABLE public.kpi_period_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  range_from DATE NOT NULL,
  range_to DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT kpi_period_presets_unique_name UNIQUE (user_id, organization_id, name)
);

-- Indexes
CREATE INDEX idx_kpi_period_presets_user_org ON public.kpi_period_presets(user_id, organization_id);

-- Enable RLS
ALTER TABLE public.kpi_period_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: only owner who is member of the org
CREATE POLICY "Users can view their own kpi presets"
  ON public.kpi_period_presets FOR SELECT
  USING (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can create their own kpi presets"
  ON public.kpi_period_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can update their own kpi presets"
  ON public.kpi_period_presets FOR UPDATE
  USING (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can delete their own kpi presets"
  ON public.kpi_period_presets FOR DELETE
  USING (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

-- Validation trigger (range and name)
CREATE OR REPLACE FUNCTION public.validate_kpi_period_preset()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Preset name cannot be empty';
  END IF;
  IF length(NEW.name) > 60 THEN
    RAISE EXCEPTION 'Preset name must be at most 60 characters';
  END IF;
  IF NEW.range_from > NEW.range_to THEN
    RAISE EXCEPTION 'range_from must be less than or equal to range_to';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_kpi_period_preset_trigger
  BEFORE INSERT OR UPDATE ON public.kpi_period_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_kpi_period_preset();

-- updated_at trigger
CREATE TRIGGER update_kpi_period_presets_updated_at
  BEFORE UPDATE ON public.kpi_period_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();