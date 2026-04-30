ALTER TABLE public.cashflow_entries REPLICA IDENTITY FULL;
ALTER TABLE public.contracts REPLICA IDENTITY FULL;
ALTER TABLE public.contract_installments REPLICA IDENTITY FULL;
ALTER TABLE public.request_tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='cashflow_entries') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cashflow_entries';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='contracts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='contract_installments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_installments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='request_tasks') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.request_tasks';
  END IF;
END $$;