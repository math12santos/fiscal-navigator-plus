
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.nine_box_status AS ENUM ('rascunho','em_calibracao','calibrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nine_box_dimension AS ENUM ('desempenho','potencial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nine_box_source AS ENUM ('gestor','auto','par');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ EVALUATIONS — novas colunas ============
ALTER TABLE public.hr_9box_evaluations
  ADD COLUMN IF NOT EXISTS status public.nine_box_status NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS confiabilidade NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS versao INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS evaluation_pai_id UUID NULL REFERENCES public.hr_9box_evaluations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vies_detectado JSONB NULL;

-- Garantir que liberado_para_colaborador permaneça sempre false (nunca visível ao colaborador)
ALTER TABLE public.hr_9box_evaluations
  ALTER COLUMN liberado_para_colaborador SET DEFAULT false;

-- ============ CRITÉRIOS (rubrica) ============
CREATE TABLE IF NOT EXISTS public.hr_9box_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dimension public.nine_box_dimension NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1,
  anchor_1 TEXT NULL,
  anchor_2 TEXT NULL,
  anchor_3 TEXT NULL,
  anchor_4 TEXT NULL,
  anchor_5 TEXT NULL,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  is_system_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_9box_criteria_org_dim ON public.hr_9box_criteria(organization_id, dimension, order_index);

ALTER TABLE public.hr_9box_criteria ENABLE ROW LEVEL SECURITY;

-- Templates de sistema visíveis a todos autenticados; críterios da org só para gestores
CREATE POLICY "9box criteria - read system templates"
  ON public.hr_9box_criteria FOR SELECT TO authenticated
  USING (organization_id IS NULL);

CREATE POLICY "9box criteria - read org"
  ON public.hr_9box_criteria FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL AND (
      has_role(auth.uid(), 'master')
      OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','manager'])
      OR has_backoffice_org_access(organization_id)
    )
  );

CREATE POLICY "9box criteria - write org"
  ON public.hr_9box_criteria FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL AND (
      has_role(auth.uid(), 'master')
      OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
      OR has_backoffice_org_access(organization_id)
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL AND (
      has_role(auth.uid(), 'master')
      OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
      OR has_backoffice_org_access(organization_id)
    )
  );

CREATE TRIGGER trg_hr_9box_criteria_updated
  BEFORE UPDATE ON public.hr_9box_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FONTES POR AVALIAÇÃO ============
CREATE TABLE IF NOT EXISTS public.hr_9box_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.hr_9box_evaluations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source public.nine_box_source NOT NULL,
  evaluator_user_id UUID NULL,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1,
  submitted BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, source)
);

CREATE INDEX IF NOT EXISTS idx_hr_9box_sources_eval ON public.hr_9box_sources(evaluation_id);

ALTER TABLE public.hr_9box_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "9box sources - manage by gestores"
  ON public.hr_9box_sources FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','manager'])
    OR has_backoffice_org_access(organization_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','manager'])
    OR has_backoffice_org_access(organization_id)
  );

-- ============ NOTAS POR CRITÉRIO ============
CREATE TABLE IF NOT EXISTS public.hr_9box_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.hr_9box_evaluations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.hr_9box_criteria(id) ON DELETE RESTRICT,
  source public.nine_box_source NOT NULL,
  score NUMERIC(3,1) NOT NULL CHECK (score >= 1 AND score <= 5),
  evidence_text TEXT NULL,
  evidence_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, criterion_id, source)
);

CREATE INDEX IF NOT EXISTS idx_hr_9box_scores_eval ON public.hr_9box_scores(evaluation_id);

ALTER TABLE public.hr_9box_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "9box scores - manage by gestores"
  ON public.hr_9box_scores FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','manager'])
    OR has_backoffice_org_access(organization_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','manager'])
    OR has_backoffice_org_access(organization_id)
  );

CREATE TRIGGER trg_hr_9box_scores_updated
  BEFORE UPDATE ON public.hr_9box_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validação de evidência obrigatória para nota >=4 ou <=2
CREATE OR REPLACE FUNCTION public.validate_9box_score_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.score >= 4 OR NEW.score <= 2)
     AND (COALESCE(NULLIF(trim(NEW.evidence_text), ''), NEW.evidence_url) IS NULL) THEN
    RAISE EXCEPTION 'Evidência é obrigatória para notas extremas (≤2 ou ≥4) no critério.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_9box_score_evidence
  BEFORE INSERT OR UPDATE ON public.hr_9box_scores
  FOR EACH ROW EXECUTE FUNCTION public.validate_9box_score_evidence();

-- ============ LOG DE CALIBRAÇÃO ============
CREATE TABLE IF NOT EXISTS public.hr_9box_calibration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.hr_9box_evaluations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  calibrator_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  notes TEXT NULL,
  changes JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_9box_calibration_log_eval ON public.hr_9box_calibration_log(evaluation_id);

ALTER TABLE public.hr_9box_calibration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "9box calibration log - read by gestores"
  ON public.hr_9box_calibration_log FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','manager'])
    OR has_backoffice_org_access(organization_id)
  );

CREATE POLICY "9box calibration log - insert by gestores"
  ON public.hr_9box_calibration_log FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
    OR has_backoffice_org_access(organization_id)
  );

-- ============ RLS REFORÇADO em hr_9box_evaluations ============
-- Bloquear leitura por colaborador comum: somente gestores/admin/master/backoffice.
DROP POLICY IF EXISTS "9box evaluations - read by org members" ON public.hr_9box_evaluations;
DROP POLICY IF EXISTS "Users can view org 9box" ON public.hr_9box_evaluations;
DROP POLICY IF EXISTS "9box evaluations - read managers only" ON public.hr_9box_evaluations;

CREATE POLICY "9box evaluations - read managers only"
  ON public.hr_9box_evaluations FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner','admin','manager'])
    OR has_backoffice_org_access(organization_id)
  );

-- ============ SEED: rubrica padrão (system template, organization_id NULL) ============
INSERT INTO public.hr_9box_criteria
  (organization_id, dimension, name, description, weight, anchor_1, anchor_2, anchor_3, anchor_4, anchor_5, order_index, is_system_template)
VALUES
  -- DESEMPENHO
  (NULL, 'desempenho', 'Entrega de resultados',
   'Atingimento de metas e BSC do colaborador.',
   40,
   'Ficou abaixo de 60% das metas.',
   'Atingiu 60–79% das metas.',
   'Atingiu 80–99% das metas.',
   'Atingiu 100–119% das metas.',
   'Superou 120% das metas com impacto visível.',
   1, true),
  (NULL, 'desempenho', 'Qualidade técnica',
   'Profundidade técnica e domínio do escopo.',
   20,
   'Entregas precisam ser refeitas com frequência.',
   'Entregas com retrabalho ocasional.',
   'Entregas dentro do esperado.',
   'Entregas acima do padrão, com poucos defeitos.',
   'Referência técnica reconhecida pelos pares.',
   2, true),
  (NULL, 'desempenho', 'Cumprimento de prazos',
   'Confiabilidade em datas e compromissos.',
   15,
   'Atrasa rotineiramente sem aviso.',
   'Atrasa eventualmente, comunica.',
   'Cumpre os prazos combinados.',
   'Antecipa entregas relevantes.',
   'Sempre dentro do prazo, mesmo em cenários complexos.',
   3, true),
  (NULL, 'desempenho', 'Colaboração',
   'Trabalho em equipe e suporte aos pares.',
   15,
   'Gera atrito e isolamento.',
   'Colabora apenas quando demandado.',
   'Colabora normalmente com o time.',
   'Apoia ativamente pares e outras áreas.',
   'Catalisa o time, conecta áreas e remove obstáculos.',
   4, true),
  (NULL, 'desempenho', 'Aderência a valores',
   'Comportamento alinhado à cultura e valores.',
   10,
   'Comportamento contrário aos valores.',
   'Aderência inconsistente.',
   'Aderente.',
   'Exemplo positivo nos valores.',
   'Embaixador da cultura, influencia o time.',
   5, true),
  -- POTENCIAL
  (NULL, 'potencial', 'Capacidade de aprendizado',
   'Velocidade e profundidade ao absorver novos temas.',
   25,
   'Resiste a aprender coisas novas.',
   'Aprende com bastante apoio.',
   'Aprende no ritmo esperado.',
   'Aprende rápido e busca conteúdo por conta própria.',
   'Domina rapidamente temas novos e ensina os outros.',
   1, true),
  (NULL, 'potencial', 'Liderança / influência',
   'Mobiliza pessoas mesmo sem cargo formal.',
   25,
   'Não influencia o time.',
   'Influência pontual.',
   'Lidera tarefas e pequenos projetos.',
   'Lidera projetos relevantes naturalmente.',
   'Liderança natural, formaria gestores.',
   2, true),
  (NULL, 'potencial', 'Adaptabilidade',
   'Lida com mudanças, ambiguidade e pressão.',
   20,
   'Trava em mudanças.',
   'Adapta-se com dificuldade.',
   'Adapta-se ao esperado.',
   'Adapta-se rápido a contextos novos.',
   'Prospera em ambiguidade e impulsiona a mudança.',
   3, true),
  (NULL, 'potencial', 'Visão estratégica',
   'Enxerga o todo, conecta decisões a impacto de negócio.',
   20,
   'Visão restrita à própria tarefa.',
   'Entende a área onde atua.',
   'Conecta sua área à empresa.',
   'Enxerga impactos cruzados entre áreas.',
   'Pensa como sócio do negócio.',
   4, true),
  (NULL, 'potencial', 'Mobilidade',
   'Disponibilidade para novos cargos, áreas ou localidades.',
   10,
   'Não tem mobilidade.',
   'Mobilidade muito limitada.',
   'Mobilidade parcial sob condições.',
   'Boa mobilidade entre áreas.',
   'Total mobilidade (cargo, área, localidade).',
   5, true)
ON CONFLICT DO NOTHING;
