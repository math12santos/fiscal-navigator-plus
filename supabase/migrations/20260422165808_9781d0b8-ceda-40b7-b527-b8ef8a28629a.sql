-- Adiciona campos para gestão de limites de crédito (capital de giro)
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS limite_tipo TEXT DEFAULT 'cheque_especial',
  ADD COLUMN IF NOT EXISTS limite_taxa_juros_mensal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_utilizado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_vencimento DATE,
  ADD COLUMN IF NOT EXISTS limite_atualizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS limite_atualizado_por UUID;

COMMENT ON COLUMN public.bank_accounts.limite_tipo IS 'Tipo de limite: cheque_especial, capital_giro, conta_garantida, antecipacao_recebiveis, outros';
COMMENT ON COLUMN public.bank_accounts.limite_taxa_juros_mensal IS 'Taxa de juros mensal do limite (% ao mês) — usado para custo de oportunidade';
COMMENT ON COLUMN public.bank_accounts.limite_utilizado IS 'Valor do limite atualmente utilizado (saldo devedor da linha de crédito)';
COMMENT ON COLUMN public.bank_accounts.limite_vencimento IS 'Data de vencimento/renovação do contrato de limite';