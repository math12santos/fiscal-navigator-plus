
-- Clear existing text values before type change
UPDATE public.cost_centers SET responsible = NULL WHERE responsible IS NOT NULL;

-- Change column type from text to uuid
ALTER TABLE public.cost_centers ALTER COLUMN responsible TYPE uuid USING NULL;
