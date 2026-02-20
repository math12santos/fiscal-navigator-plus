
-- Add commission type (fixed value or percentage) to commercial_channels
ALTER TABLE public.commercial_channels
ADD COLUMN comissao_tipo text NOT NULL DEFAULT 'percentual';

-- Add channel_type to distinguish digital channels from fairs/events
ALTER TABLE public.commercial_channels
ADD COLUMN channel_type text NOT NULL DEFAULT 'digital';

-- Add comissao_valor_fixo for fixed commission amount
ALTER TABLE public.commercial_channels
ADD COLUMN comissao_valor_fixo numeric DEFAULT 0;
