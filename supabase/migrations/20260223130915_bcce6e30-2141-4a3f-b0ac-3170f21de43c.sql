
-- =============================================
-- MÓDULO DP — DEPARTAMENTO PESSOAL
-- =============================================

-- 1. Cargos / Posições (Organograma)
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  level_hierarchy integer NOT NULL DEFAULT 1,
  parent_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  salary_min numeric DEFAULT 0,
  salary_max numeric DEFAULT 0,
  contract_types text[] DEFAULT ARRAY['CLT'],
  responsibilities text,
  approval_limits text,
  substitution_rules text,
  evidence_requirements text,
  active boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view positions" ON public.positions FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create positions" ON public.positions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update positions" ON public.positions FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete positions" ON public.positions FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- 2. Rotinas por Cargo
CREATE TABLE public.position_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text,
  checklist text,
  periodicity text NOT NULL DEFAULT 'mensal',
  sla_days integer DEFAULT 1,
  dependencies text,
  integration_modules text[],
  calendar_event_id text,
  active boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.position_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view routines" ON public.position_routines FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create routines" ON public.position_routines FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update routines" ON public.position_routines FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete routines" ON public.position_routines FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- 3. Colaboradores
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  name text NOT NULL,
  cpf text,
  email text,
  phone text,
  admission_date date NOT NULL,
  dismissal_date date,
  contract_type text NOT NULL DEFAULT 'CLT',
  salary_base numeric NOT NULL DEFAULT 0,
  workload_hours integer DEFAULT 44,
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view employees" ON public.employees FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create employees" ON public.employees FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update employees" ON public.employees FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete employees" ON public.employees FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- 4. Remunerações adicionais
CREATE TABLE public.employee_compensations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'fixo',
  description text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  recurrence text DEFAULT 'mensal',
  active boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_compensations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view compensations" ON public.employee_compensations FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create compensations" ON public.employee_compensations FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update compensations" ON public.employee_compensations FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete compensations" ON public.employee_compensations FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- 5. Folha de Pagamento (runs)
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  total_bruto numeric DEFAULT 0,
  total_descontos numeric DEFAULT 0,
  total_liquido numeric DEFAULT 0,
  total_encargos numeric DEFAULT 0,
  locked boolean NOT NULL DEFAULT false,
  notes text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, reference_month)
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view payroll" ON public.payroll_runs FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create payroll" ON public.payroll_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update payroll" ON public.payroll_runs FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete payroll" ON public.payroll_runs FOR DELETE
  USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));

-- 6. Itens da folha por colaborador
CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salario_base numeric DEFAULT 0,
  horas_extras numeric DEFAULT 0,
  comissoes numeric DEFAULT 0,
  adicionais numeric DEFAULT 0,
  dsr numeric DEFAULT 0,
  inss_empregado numeric DEFAULT 0,
  irrf numeric DEFAULT 0,
  vt_desconto numeric DEFAULT 0,
  faltas_desconto numeric DEFAULT 0,
  outros_descontos numeric DEFAULT 0,
  inss_patronal numeric DEFAULT 0,
  fgts numeric DEFAULT 0,
  total_bruto numeric DEFAULT 0,
  total_descontos numeric DEFAULT 0,
  total_liquido numeric DEFAULT 0,
  total_encargos numeric DEFAULT 0,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view payroll items" ON public.payroll_items FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create payroll items" ON public.payroll_items FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update payroll items" ON public.payroll_items FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete payroll items" ON public.payroll_items FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- 7. Férias
CREATE TABLE public.employee_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio date NOT NULL,
  periodo_aquisitivo_fim date NOT NULL,
  data_inicio date,
  data_fim date,
  dias_gozados integer DEFAULT 0,
  dias_vendidos integer DEFAULT 0,
  valor_ferias numeric DEFAULT 0,
  valor_terco numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  provisao_mensal numeric DEFAULT 0,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view vacations" ON public.employee_vacations FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create vacations" ON public.employee_vacations FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update vacations" ON public.employee_vacations FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete vacations" ON public.employee_vacations FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- 8. Rescisões
CREATE TABLE public.employee_terminations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  termination_date date NOT NULL,
  type text NOT NULL DEFAULT 'sem_justa_causa',
  saldo_salario numeric DEFAULT 0,
  aviso_previo numeric DEFAULT 0,
  ferias_proporcionais numeric DEFAULT 0,
  terco_ferias numeric DEFAULT 0,
  decimo_terceiro_proporcional numeric DEFAULT 0,
  multa_fgts numeric DEFAULT 0,
  total_rescisao numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'simulacao',
  notes text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view terminations" ON public.employee_terminations FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create terminations" ON public.employee_terminations FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update terminations" ON public.employee_terminations FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete terminations" ON public.employee_terminations FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- 9. Planejamento RH (simulações)
CREATE TABLE public.hr_planning_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  scenario_name text NOT NULL DEFAULT 'Base',
  type text NOT NULL DEFAULT 'contratacao',
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  planned_date date NOT NULL,
  quantity integer DEFAULT 1,
  salary_estimated numeric DEFAULT 0,
  total_cost_estimated numeric DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'planejado',
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_planning_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view hr planning" ON public.hr_planning_items FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create hr planning" ON public.hr_planning_items FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update hr planning" ON public.hr_planning_items FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete hr planning" ON public.hr_planning_items FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- 10. Configurações DP
CREATE TABLE public.dp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  inss_patronal_pct numeric DEFAULT 20,
  rat_pct numeric DEFAULT 2,
  fgts_pct numeric DEFAULT 8,
  terceiros_pct numeric DEFAULT 5.8,
  provisao_ferias_pct numeric DEFAULT 11.11,
  provisao_13_pct numeric DEFAULT 8.33,
  vt_desconto_pct numeric DEFAULT 6,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view dp config" ON public.dp_config FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can create dp config" ON public.dp_config FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update dp config" ON public.dp_config FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
