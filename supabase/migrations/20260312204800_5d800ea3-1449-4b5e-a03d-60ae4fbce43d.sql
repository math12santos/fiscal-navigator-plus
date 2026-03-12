
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id),
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS competencia text,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS classified_by uuid,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cashflow_entry_id uuid REFERENCES public.cashflow_entries(id);
