
-- =============================================
-- Tabela: chart_of_accounts
-- =============================================
CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  nature text NOT NULL DEFAULT 'neutro',
  accounting_class text NOT NULL DEFAULT 'resultado',
  level integer NOT NULL DEFAULT 1,
  parent_id uuid REFERENCES public.chart_of_accounts(id),
  description text,
  tags text[],
  is_synthetic boolean NOT NULL DEFAULT false,
  is_system_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chart_of_accounts_user_code_unique UNIQUE (user_id, code),
  CONSTRAINT chart_of_accounts_type_check CHECK (type IN ('receita', 'custo', 'despesa', 'investimento', 'transferencia')),
  CONSTRAINT chart_of_accounts_nature_check CHECK (nature IN ('entrada', 'saida', 'neutro')),
  CONSTRAINT chart_of_accounts_accounting_class_check CHECK (accounting_class IN ('ativo', 'passivo', 'pl', 'resultado')),
  CONSTRAINT chart_of_accounts_level_check CHECK (level BETWEEN 1 AND 4)
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON public.chart_of_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own accounts" ON public.chart_of_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.chart_of_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.chart_of_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Tabela: cost_centers
-- =============================================
CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.cost_centers(id),
  business_unit text,
  responsible text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_centers_user_code_unique UNIQUE (user_id, code)
);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cost centers" ON public.cost_centers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cost centers" ON public.cost_centers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cost centers" ON public.cost_centers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cost centers" ON public.cost_centers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Tabela: audit_log (Fase 1.1)
-- =============================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs" ON public.audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit logs" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);
