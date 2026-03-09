
-- Table for onboarding step configuration
CREATE TABLE public.onboarding_step_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number integer NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT NULL,
  UNIQUE(step_number)
);

ALTER TABLE public.onboarding_step_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage step config" ON public.onboarding_step_config
  FOR ALL TO public USING (has_role(auth.uid(), 'master'));

CREATE POLICY "Authenticated can read step config" ON public.onboarding_step_config
  FOR SELECT TO authenticated USING (true);

-- Seed Step 1: Diagnóstico
INSERT INTO public.onboarding_step_config (step_number, config) VALUES
(1, '{
  "sections": [
    {
      "key": "estrutura", "label": "Estrutura", "icon": "Building2", "order": 0,
      "questions": [
        { "key": "num_empresas", "label": "Quantas empresas existem no grupo?", "options": [
          {"value":"1","label":"1","points":0},
          {"value":"2-5","label":"2 a 5","points":1},
          {"value":"6+","label":"6 ou mais","points":2}
        ]},
        { "key": "tem_holding", "label": "Existe holding?", "options": [
          {"value":"sim","label":"Sim","points":1},
          {"value":"nao","label":"Não","points":0}
        ]},
        { "key": "num_cnpjs", "label": "Quantos CNPJs existem?", "options": [
          {"value":"1","label":"1","points":0},
          {"value":"2-5","label":"2 a 5","points":0},
          {"value":"6+","label":"6 ou mais","points":0}
        ]}
      ]
    },
    {
      "key": "maturidade", "label": "Maturidade do Financeiro", "icon": "BarChart3", "order": 1,
      "questions": [
        { "key": "controle_caixa", "label": "Como o fluxo de caixa é controlado atualmente?", "options": [
          {"value":"nenhum","label":"Sem controle","points":0},
          {"value":"planilha","label":"Planilha","points":1},
          {"value":"erp","label":"ERP","points":2}
        ]}
      ]
    },
    {
      "key": "sistema", "label": "Sistema Financeiro", "icon": "FileText", "order": 2,
      "questions": [
        { "key": "auditoria", "label": "Existe processo de auditoria dos pagamentos?", "options": [
          {"value":"sim","label":"Sim","points":2},
          {"value":"nao","label":"Não","points":0}
        ]},
        { "key": "dre", "label": "Existe DRE gerencial mensal?", "options": [
          {"value":"nao","label":"Não existe controle","points":0},
          {"value":"gerencial","label":"Sim, DRE gerencial","points":2},
          {"value":"integrada","label":"Sim, integrada à DRE contábil","points":3}
        ]}
      ]
    },
    {
      "key": "tecnologia", "label": "Tecnologia", "icon": "Cpu", "order": 3,
      "questions": [
        { "key": "usa_erp", "label": "Utiliza algum ERP?", "options": [
          {"value":"sim","label":"Sim","points":1},
          {"value":"nao","label":"Não","points":0}
        ]}
      ]
    }
  ],
  "thresholds": [
    { "level": 1, "label": "Controle básico", "min_score": 0, "max_score": 2 },
    { "level": 2, "label": "Financeiro estruturado", "min_score": 3, "max_score": 4 },
    { "level": 3, "label": "Controladoria", "min_score": 5, "max_score": 6 },
    { "level": 4, "label": "Governança financeira", "min_score": 7, "max_score": 8 },
    { "level": 5, "label": "Gestão orientada por dados", "min_score": 9, "max_score": 99 }
  ]
}'::jsonb),

-- Seed Steps 2-9: Shell steps
(2, '{"title":"Estrutura da Empresa","description":"Configure a estrutura organizacional do grupo","icon":"Building2","items":["Empresas do grupo (holding, operacionais, filiais)","Usuários principais (CEO, CFO, Controller)","Áreas organizacionais (Financeiro, Comercial, Operações)"]}'::jsonb),
(3, '{"title":"Integrações","description":"Conecte fontes de dados ao sistema","icon":"Plug","items":["Bancos (Open Banking, OFX, CSV)","ERPs (Conta Azul, Omie, Bling, TOTVS)","Importação manual de planilhas"]}'::jsonb),
(4, '{"title":"Estrutura Financeira","description":"Configure plano de contas e centros de custo","icon":"Wallet","items":["Plano de contas gerencial padrão","Centros de custo sugeridos","Personalização e criação livre"]}'::jsonb),
(5, '{"title":"Cadastro de Contratos","description":"Registre contratos que impactam o fluxo de caixa","icon":"FileText","items":["Contratos de receita (clientes, recorrentes, projetos)","Contratos de despesa (fornecedores, softwares, serviços)","Investimentos (compra e venda de ativos)"]}'::jsonb),
(6, '{"title":"Planejamento Financeiro","description":"Configure orçamento e cenários","icon":"Target","items":["Orçamento anual","Cenários (Base, Conservador, Expansão)","Projeções (12, 24, 36 meses)"]}'::jsonb),
(7, '{"title":"Rotinas Financeiras","description":"Configure rotinas sugeridas para o dia a dia","icon":"CalendarCheck","items":["Diárias: conciliação bancária, atualização de saldo","Semanais: revisão de fluxo de caixa, análise de recebimentos","Mensais: fechamento financeiro, DRE gerencial"]}'::jsonb),
(8, '{"title":"Ativação do Cockpit","description":"Libere os dashboards financeiros","icon":"LayoutDashboard","items":["Dashboard CFO (caixa, runway, MRR, margem, burn rate)","Dashboard Board (saúde financeira, projeção, riscos)"]}'::jsonb),
(9, '{"title":"Operação Assistida","description":"Recomendações automáticas nos primeiros 90 dias","icon":"Lightbulb","items":["Alertas de dados faltantes","Sugestões de melhoria de classificação","Acompanhamento de preenchimento"]}'::jsonb),

-- Seed Step 10: Score
(10, '{
  "dimensions": [
    { "key": "controle", "label": "Controle Financeiro", "icon": "ShieldCheck", "color": "text-emerald-500", "steps": [1, 4] },
    { "key": "planejamento", "label": "Planejamento", "icon": "Target", "color": "text-blue-500", "steps": [6] },
    { "key": "governanca", "label": "Governança", "icon": "BarChart3", "color": "text-violet-500", "steps": [5, 7] },
    { "key": "previsibilidade", "label": "Previsibilidade", "icon": "Trophy", "color": "text-amber-500", "steps": [6, 8] },
    { "key": "qualidade", "label": "Qualidade dos Dados", "icon": "Database", "color": "text-cyan-500", "steps": [3, 4] }
  ],
  "thresholds": [
    { "label": "Bronze", "min_pct": 0 },
    { "label": "Prata", "min_pct": 40 },
    { "label": "Ouro", "min_pct": 60 },
    { "label": "Board Ready", "min_pct": 80 }
  ]
}'::jsonb);
