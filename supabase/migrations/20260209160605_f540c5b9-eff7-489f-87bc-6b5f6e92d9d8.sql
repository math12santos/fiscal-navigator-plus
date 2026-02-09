
-- Table to store plan migration history (wizard state)
CREATE TABLE public.plan_migrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  mapping_accounts JSONB DEFAULT '{}',
  mapping_cost_centers JSONB DEFAULT '{}',
  notes TEXT
);

ALTER TABLE public.plan_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own migrations"
  ON public.plan_migrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own migrations"
  ON public.plan_migrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own migrations"
  ON public.plan_migrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own migrations"
  ON public.plan_migrations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_plan_migrations_updated_at
  BEFORE UPDATE ON public.plan_migrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check linked transactions for accounts and cost centers
-- Returns counts of references across financial tables
CREATE OR REPLACE FUNCTION public.check_linked_transactions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  account_refs INT := 0;
  center_refs INT := 0;
BEGIN
  -- Check contracts referencing cost centers or accounts
  -- (contracts table exists but doesn't have account_id/cost_center_id yet)
  -- Future: add checks for cashflow_entries, bank_transactions, journal_entries
  
  -- For now, return zero counts since no financial tables reference these yet
  -- This function will be extended as financial tables are created
  
  result := jsonb_build_object(
    'has_linked_transactions', false,
    'account_references', 0,
    'cost_center_references', 0,
    'details', jsonb_build_object()
  );
  
  RETURN result;
END;
$$;
