ALTER TABLE public.dp_config
ADD COLUMN IF NOT EXISTS custom_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.dp_config.custom_items IS 'Array de itens customizados de encargos/provisões/descontos. Cada item: { id: string, category: "encargo"|"provisao"|"desconto", label: string, pct: number }';