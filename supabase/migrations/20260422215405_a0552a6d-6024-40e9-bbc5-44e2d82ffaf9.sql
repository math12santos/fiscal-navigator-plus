ALTER TABLE public.dp_config
ADD COLUMN IF NOT EXISTS pending_holding_suggestion jsonb DEFAULT NULL;

COMMENT ON COLUMN public.dp_config.pending_holding_suggestion IS 'Sugestão de percentuais propagada pela holding, aguardando revisão da subsidiária. Estrutura: { base: {...}, custom_items: [...], suggested_at: timestamp, suggested_by_org_id: uuid, suggested_by_org_name: text }';