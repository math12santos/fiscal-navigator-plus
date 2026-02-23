
-- Table to store system-wide module enabled/disabled status
CREATE TABLE public.system_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_message TEXT DEFAULT 'Este módulo está temporariamente indisponível para manutenção.',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (needed to check if module is enabled)
CREATE POLICY "Authenticated users can view system modules"
ON public.system_modules
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only masters can modify
CREATE POLICY "Masters can update system modules"
ON public.system_modules
FOR UPDATE
USING (has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can insert system modules"
ON public.system_modules
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can delete system modules"
ON public.system_modules
FOR DELETE
USING (has_role(auth.uid(), 'master'));

-- Seed default modules
INSERT INTO public.system_modules (module_key, label, enabled) VALUES
  ('dashboard', 'Dashboard', true),
  ('fluxo-caixa', 'Fluxo de Caixa', true),
  ('contratos', 'Contratos', true),
  ('planejamento', 'Planejamento', true),
  ('conciliacao', 'Conciliação', true),
  ('dp', 'Departamento Pessoal', true),
  ('documentos', 'Documentos da Empresa', true),
  ('configuracoes', 'Configurações', true),
  ('tarefas', 'Tarefas', true),
  ('ia-financeira', 'IA Financeira', true),
  ('integracoes', 'Integrações', true);

-- Trigger for updated_at
CREATE TRIGGER update_system_modules_updated_at
BEFORE UPDATE ON public.system_modules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
