-- ============================================================
-- MÓDULO GESTÃO DE DESEMPENHO (DP/RH)
-- ============================================================

-- ============== ENUMS ==============
DO $$ BEGIN
  CREATE TYPE public.pdi_status AS ENUM ('nao_iniciado','em_andamento','em_atraso','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pdi_action_status AS ENUM ('pendente','em_andamento','concluida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pdi_action_tipo AS ENUM ('treinamento','mentoria','pratica','leitura','curso','reuniao','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.one_on_one_tipo AS ENUM ('mensal','quinzenal','trimestral','extraordinaria');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.one_on_one_status AS ENUM ('agendada','realizada','remarcada','cancelada','pendente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.one_on_one_humor AS ENUM ('muito_bom','bom','neutro','ruim','critico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nine_box_recomendacao AS ENUM ('manter','desenvolver','promover','realocar','acompanhar','desligamento_em_analise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bsc_tipo AS ENUM ('individual','departamento','empresa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bsc_status AS ENUM ('em_elaboracao','ativo','encerrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bsc_perspectiva AS ENUM ('financeira','clientes','processos','aprendizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bsc_indicator_status AS ENUM ('abaixo','parcial','atingido','superado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bsc_frequencia AS ENUM ('mensal','trimestral','semestral','anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== HR_DEPARTMENTS ==============
CREATE TABLE public.hr_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  manager_user_id UUID,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_hr_departments_org ON public.hr_departments(organization_id);
ALTER TABLE public.hr_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view departments" ON public.hr_departments
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert departments" ON public.hr_departments
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update departments" ON public.hr_departments
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete departments" ON public.hr_departments
FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice manage departments" ON public.hr_departments
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_departments_updated_at
BEFORE UPDATE ON public.hr_departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincula employees e positions a departamento (opcional, retro-compatível)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL;

-- ============== HR_PDIS ==============
CREATE TABLE public.hr_pdis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  manager_user_id UUID,
  created_by UUID NOT NULL,
  objetivo TEXT NOT NULL,
  competencia TEXT,
  justificativa TEXT,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao_prevista DATE,
  data_conclusao_real DATE,
  status public.pdi_status NOT NULL DEFAULT 'nao_iniciado',
  percentual_evolucao NUMERIC NOT NULL DEFAULT 0,
  obs_rh TEXT,
  obs_gestor TEXT,
  obs_colaborador TEXT,
  liberado_para_colaborador BOOLEAN NOT NULL DEFAULT false,
  source_one_on_one_id UUID,
  source_9box_id UUID,
  ultima_atualizacao_em TIMESTAMPTZ,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_pdis_org ON public.hr_pdis(organization_id);
CREATE INDEX idx_hr_pdis_employee ON public.hr_pdis(employee_id);
CREATE INDEX idx_hr_pdis_status ON public.hr_pdis(status);

ALTER TABLE public.hr_pdis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view pdis" ON public.hr_pdis
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert pdis" ON public.hr_pdis
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update pdis" ON public.hr_pdis
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete pdis" ON public.hr_pdis
FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice manage pdis" ON public.hr_pdis
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_pdis_updated_at BEFORE UPDATE ON public.hr_pdis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: marca como em_atraso quando passa do prazo
CREATE OR REPLACE FUNCTION public.set_pdi_em_atraso()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('concluido','cancelado')
     AND NEW.data_conclusao_prevista IS NOT NULL
     AND NEW.data_conclusao_prevista < CURRENT_DATE THEN
    NEW.status := 'em_atraso';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pdi_em_atraso BEFORE INSERT OR UPDATE ON public.hr_pdis
FOR EACH ROW EXECUTE FUNCTION public.set_pdi_em_atraso();

-- ============== HR_PDI_ACTIONS ==============
CREATE TABLE public.hr_pdi_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pdi_id UUID NOT NULL REFERENCES public.hr_pdis(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  tipo public.pdi_action_tipo NOT NULL DEFAULT 'outro',
  responsavel_user_id UUID,
  prazo DATE,
  status public.pdi_action_status NOT NULL DEFAULT 'pendente',
  evidencia TEXT,
  comentarios TEXT,
  concluida_em TIMESTAMPTZ,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_pdi_actions_pdi ON public.hr_pdi_actions(pdi_id);

ALTER TABLE public.hr_pdi_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view pdi_actions" ON public.hr_pdi_actions
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert pdi_actions" ON public.hr_pdi_actions
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update pdi_actions" ON public.hr_pdi_actions
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete pdi_actions" ON public.hr_pdi_actions
FOR DELETE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Backoffice manage pdi_actions" ON public.hr_pdi_actions
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_pdi_actions_updated_at BEFORE UPDATE ON public.hr_pdi_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: recalcula percentual_evolucao do PDI quando ação muda
CREATE OR REPLACE FUNCTION public.recompute_pdi_evolution()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_pdi_id UUID;
  v_total INT;
  v_done INT;
BEGIN
  v_pdi_id := COALESCE(NEW.pdi_id, OLD.pdi_id);
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluida')
    INTO v_total, v_done FROM public.hr_pdi_actions WHERE pdi_id = v_pdi_id;
  UPDATE public.hr_pdis
    SET percentual_evolucao = CASE WHEN v_total > 0 THEN ROUND(v_done::numeric / v_total * 100, 1) ELSE 0 END,
        ultima_atualizacao_em = now()
    WHERE id = v_pdi_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_pdi_evolution AFTER INSERT OR UPDATE OR DELETE ON public.hr_pdi_actions
FOR EACH ROW EXECUTE FUNCTION public.recompute_pdi_evolution();

-- ============== HR_ONE_ON_ONES ==============
CREATE TABLE public.hr_one_on_ones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  manager_user_id UUID,
  data_reuniao TIMESTAMPTZ NOT NULL,
  tipo public.one_on_one_tipo NOT NULL DEFAULT 'mensal',
  status public.one_on_one_status NOT NULL DEFAULT 'agendada',
  humor public.one_on_one_humor,
  pauta TEXT,
  pontos_discutidos TEXT,
  dificuldades TEXT,
  entregas_recentes TEXT,
  feedback_gestor TEXT,
  feedback_colaborador TEXT,
  decisoes TEXT,
  proximos_passos TEXT,
  proxima_reuniao_sugerida DATE,
  liberado_para_colaborador BOOLEAN NOT NULL DEFAULT true,
  previous_id UUID REFERENCES public.hr_one_on_ones(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_oneonones_org ON public.hr_one_on_ones(organization_id);
CREATE INDEX idx_hr_oneonones_employee ON public.hr_one_on_ones(employee_id);
CREATE INDEX idx_hr_oneonones_data ON public.hr_one_on_ones(data_reuniao);

ALTER TABLE public.hr_one_on_ones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view 1:1" ON public.hr_one_on_ones
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert 1:1" ON public.hr_one_on_ones
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update 1:1" ON public.hr_one_on_ones
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete 1:1" ON public.hr_one_on_ones
FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice manage 1:1" ON public.hr_one_on_ones
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_oneonones_updated_at BEFORE UPDATE ON public.hr_one_on_ones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== HR_ONE_ON_ONE_ACTIONS (encaminhamentos) ==============
CREATE TABLE public.hr_one_on_one_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  one_on_one_id UUID NOT NULL REFERENCES public.hr_one_on_ones(id) ON DELETE CASCADE,
  tarefa TEXT NOT NULL,
  responsavel_user_id UUID,
  prazo DATE,
  status public.pdi_action_status NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_oneonone_actions_parent ON public.hr_one_on_one_actions(one_on_one_id);

ALTER TABLE public.hr_one_on_one_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view 1:1 actions" ON public.hr_one_on_one_actions
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert 1:1 actions" ON public.hr_one_on_one_actions
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update 1:1 actions" ON public.hr_one_on_one_actions
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete 1:1 actions" ON public.hr_one_on_one_actions
FOR DELETE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Backoffice manage 1:1 actions" ON public.hr_one_on_one_actions
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_oneonone_actions_updated_at BEFORE UPDATE ON public.hr_one_on_one_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== HR_9BOX_EVALUATIONS ==============
CREATE TABLE public.hr_9box_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_user_id UUID NOT NULL,
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  nota_desempenho NUMERIC(3,1) NOT NULL CHECK (nota_desempenho BETWEEN 1 AND 5),
  nota_potencial NUMERIC(3,1) NOT NULL CHECK (nota_potencial BETWEEN 1 AND 5),
  nivel_desempenho TEXT,           -- baixo|medio|alto (derivado)
  nivel_potencial TEXT,            -- baixo|medio|alto (derivado)
  quadrante INT,                   -- 1..9 (derivado)
  justificativa TEXT,
  pontos_fortes TEXT,
  pontos_atencao TEXT,
  risco_perda TEXT CHECK (risco_perda IN ('baixo','medio','alto')) DEFAULT 'baixo',
  indicacao_sucessao BOOLEAN NOT NULL DEFAULT false,
  recomendacao public.nine_box_recomendacao NOT NULL DEFAULT 'manter',
  bsc_score_snapshot NUMERIC,
  liberado_para_colaborador BOOLEAN NOT NULL DEFAULT false,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_9box_org ON public.hr_9box_evaluations(organization_id);
CREATE INDEX idx_hr_9box_employee_data ON public.hr_9box_evaluations(employee_id, data_avaliacao DESC);

ALTER TABLE public.hr_9box_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view 9box" ON public.hr_9box_evaluations
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert 9box" ON public.hr_9box_evaluations
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update 9box" ON public.hr_9box_evaluations
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete 9box" ON public.hr_9box_evaluations
FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice manage 9box" ON public.hr_9box_evaluations
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_9box_updated_at BEFORE UPDATE ON public.hr_9box_evaluations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: calcula nivel_desempenho, nivel_potencial e quadrante
CREATE OR REPLACE FUNCTION public.compute_9box_quadrante()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  d INT; p INT;
BEGIN
  -- Faixas: 1-2 baixo, 3 médio, 4-5 alto
  IF NEW.nota_desempenho < 3 THEN NEW.nivel_desempenho := 'baixo'; d := 0;
  ELSIF NEW.nota_desempenho < 4 THEN NEW.nivel_desempenho := 'medio'; d := 1;
  ELSE NEW.nivel_desempenho := 'alto'; d := 2;
  END IF;

  IF NEW.nota_potencial < 3 THEN NEW.nivel_potencial := 'baixo'; p := 0;
  ELSIF NEW.nota_potencial < 4 THEN NEW.nivel_potencial := 'medio'; p := 1;
  ELSE NEW.nivel_potencial := 'alto'; p := 2;
  END IF;

  -- Quadrante 1..9 conforme spec do documento (linha=potencial, col=desempenho)
  -- 1 baixo+baixo (risco), 2 médio+baixo, 3 alto+baixo
  -- 4 baixo+médio,         5 médio+médio, 6 alto+médio
  -- 7 baixo+alto,          8 médio+alto,  9 alto+alto
  NEW.quadrante := (p * 3) + d + 1;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_9box_quadrante BEFORE INSERT OR UPDATE ON public.hr_9box_evaluations
FOR EACH ROW EXECUTE FUNCTION public.compute_9box_quadrante();

-- ============== HR_BSC_SCORECARDS ==============
CREATE TABLE public.hr_bsc_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo public.bsc_tipo NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  manager_user_id UUID,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  status public.bsc_status NOT NULL DEFAULT 'em_elaboracao',
  resultado_geral NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  liberado_para_colaborador BOOLEAN NOT NULL DEFAULT false,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bsc_target_required CHECK (
    (tipo = 'individual' AND employee_id IS NOT NULL)
    OR (tipo = 'departamento' AND department_id IS NOT NULL)
    OR (tipo = 'empresa')
  )
);
CREATE INDEX idx_hr_bsc_org ON public.hr_bsc_scorecards(organization_id);
CREATE INDEX idx_hr_bsc_employee ON public.hr_bsc_scorecards(employee_id);

ALTER TABLE public.hr_bsc_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view bsc" ON public.hr_bsc_scorecards
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert bsc" ON public.hr_bsc_scorecards
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update bsc" ON public.hr_bsc_scorecards
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete bsc" ON public.hr_bsc_scorecards
FOR DELETE USING (has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']));
CREATE POLICY "Backoffice manage bsc" ON public.hr_bsc_scorecards
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_bsc_updated_at BEFORE UPDATE ON public.hr_bsc_scorecards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== HR_BSC_INDICATORS ==============
CREATE TABLE public.hr_bsc_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bsc_id UUID NOT NULL REFERENCES public.hr_bsc_scorecards(id) ON DELETE CASCADE,
  perspectiva public.bsc_perspectiva NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  meta NUMERIC NOT NULL,
  realizado NUMERIC NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'pct',  -- rs|pct|qtd|dias|horas|indice
  peso NUMERIC NOT NULL DEFAULT 1,
  frequencia public.bsc_frequencia NOT NULL DEFAULT 'mensal',
  fonte_dado TEXT,
  responsavel_user_id UUID,
  quanto_menor_melhor BOOLEAN NOT NULL DEFAULT false,
  percentual_atingimento NUMERIC NOT NULL DEFAULT 0,
  nota_ponderada NUMERIC NOT NULL DEFAULT 0,
  status public.bsc_indicator_status NOT NULL DEFAULT 'abaixo',
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_bsc_indicators_bsc ON public.hr_bsc_indicators(bsc_id);

ALTER TABLE public.hr_bsc_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view bsc indicators" ON public.hr_bsc_indicators
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert bsc indicators" ON public.hr_bsc_indicators
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update bsc indicators" ON public.hr_bsc_indicators
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete bsc indicators" ON public.hr_bsc_indicators
FOR DELETE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Backoffice manage bsc indicators" ON public.hr_bsc_indicators
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

CREATE TRIGGER set_hr_bsc_indicators_updated_at BEFORE UPDATE ON public.hr_bsc_indicators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: calcula percentual, nota ponderada e status, e atualiza total do BSC
CREATE OR REPLACE FUNCTION public.compute_bsc_indicator()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_pct NUMERIC;
  v_total_peso NUMERIC;
  v_total_pond NUMERIC;
BEGIN
  IF NEW.meta = 0 THEN
    v_pct := 0;
  ELSIF NEW.quanto_menor_melhor THEN
    v_pct := ROUND((NEW.meta / NULLIF(NEW.realizado, 0)) * 100, 2);
  ELSE
    v_pct := ROUND((NEW.realizado / NEW.meta) * 100, 2);
  END IF;
  IF v_pct IS NULL THEN v_pct := 0; END IF;

  NEW.percentual_atingimento := v_pct;
  NEW.nota_ponderada := ROUND(v_pct * NEW.peso, 2);

  NEW.status := CASE
    WHEN v_pct < 70 THEN 'abaixo'
    WHEN v_pct < 90 THEN 'parcial'
    WHEN v_pct <= 100 THEN 'atingido'
    ELSE 'superado'
  END::public.bsc_indicator_status;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_bsc_indicator_compute BEFORE INSERT OR UPDATE ON public.hr_bsc_indicators
FOR EACH ROW EXECUTE FUNCTION public.compute_bsc_indicator();

-- Recompute total do BSC após mudanças
CREATE OR REPLACE FUNCTION public.recompute_bsc_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_bsc_id UUID;
  v_total_peso NUMERIC;
  v_total_pond NUMERIC;
BEGIN
  v_bsc_id := COALESCE(NEW.bsc_id, OLD.bsc_id);
  SELECT COALESCE(SUM(peso),0), COALESCE(SUM(nota_ponderada),0)
    INTO v_total_peso, v_total_pond FROM public.hr_bsc_indicators WHERE bsc_id = v_bsc_id;
  UPDATE public.hr_bsc_scorecards
    SET resultado_geral = CASE WHEN v_total_peso > 0 THEN ROUND(v_total_pond / v_total_peso, 2) ELSE 0 END
    WHERE id = v_bsc_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_bsc_total AFTER INSERT OR UPDATE OR DELETE ON public.hr_bsc_indicators
FOR EACH ROW EXECUTE FUNCTION public.recompute_bsc_total();

-- ============== HR_BSC_HISTORY (mensal por indicador) ==============
CREATE TABLE public.hr_bsc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bsc_id UUID NOT NULL REFERENCES public.hr_bsc_scorecards(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.hr_bsc_indicators(id) ON DELETE CASCADE,
  periodo_mes DATE NOT NULL,
  realizado NUMERIC NOT NULL DEFAULT 0,
  percentual NUMERIC NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (indicator_id, periodo_mes)
);
CREATE INDEX idx_hr_bsc_history_bsc ON public.hr_bsc_history(bsc_id);
CREATE INDEX idx_hr_bsc_history_periodo ON public.hr_bsc_history(periodo_mes);

ALTER TABLE public.hr_bsc_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view bsc history" ON public.hr_bsc_history
FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert bsc history" ON public.hr_bsc_history
FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update bsc history" ON public.hr_bsc_history
FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Backoffice manage bsc history" ON public.hr_bsc_history
FOR ALL USING (has_backoffice_org_access(organization_id))
WITH CHECK (has_backoffice_org_access(organization_id));

-- Snapshot mensal automático ao atualizar realizado do indicador
CREATE OR REPLACE FUNCTION public.snapshot_bsc_indicator()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_periodo DATE;
BEGIN
  v_periodo := date_trunc('month', CURRENT_DATE)::date;
  INSERT INTO public.hr_bsc_history (organization_id, bsc_id, indicator_id, periodo_mes, realizado, percentual)
  VALUES (NEW.organization_id, NEW.bsc_id, NEW.id, v_periodo, NEW.realizado, NEW.percentual_atingimento)
  ON CONFLICT (indicator_id, periodo_mes) DO UPDATE
    SET realizado = EXCLUDED.realizado,
        percentual = EXCLUDED.percentual,
        snapshot_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bsc_indicator_snapshot AFTER INSERT OR UPDATE OF realizado ON public.hr_bsc_indicators
FOR EACH ROW EXECUTE FUNCTION public.snapshot_bsc_indicator();

-- ============== Realtime ==============
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_pdis;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_pdi_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_one_on_ones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_one_on_one_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_9box_evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_bsc_indicators;