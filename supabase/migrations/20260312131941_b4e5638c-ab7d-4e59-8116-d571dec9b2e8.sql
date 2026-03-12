
-- Add expense_request_id to cashflow_entries
ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS expense_request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_expense_request_id ON public.cashflow_entries(expense_request_id);
