
-- Add entity_id to contracts for client association
ALTER TABLE public.contracts ADD COLUMN entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_contracts_entity_id ON public.contracts (entity_id);
