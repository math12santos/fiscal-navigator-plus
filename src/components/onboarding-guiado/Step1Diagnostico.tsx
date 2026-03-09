import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Building2, BarChart3, FileText, Cpu, Target, Wallet, Plug, CalendarCheck, LayoutDashboard, Lightbulb, ShieldCheck, Trophy, Database, TrendingUp } from "lucide-react";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { type LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Building2, BarChart3, FileText, Cpu, Target, Wallet, Plug, CalendarCheck, LayoutDashboard, Lightbulb, ShieldCheck, Trophy, Database, TrendingUp,
};

const SEGMENTO_OPTIONS = ["Comércio", "Serviços", "Indústria", "Tecnologia", "Outro"];

// Scoring for contas bancárias: 1 point per account, capped at 5 pts max
function calcContasBancariasScore(val: string): number {
  const n = parseInt(val, 10);
  if (isNaN(n) || n <= 0) return 0;
  return Math.min(n, 5);
}

const FALLBACK_SECTIONS = [
  {
    key: "estrutura", label: "Estrutura Societária e Porte", icon: "Building2", order: 0, max_points: 20,
    questions: [
      {
        key: "faturamento_mensal", label: "Faturamento médio mensal", type: "radio",
        options: [
          { value: "ate_50k", label: "Até R$ 50 mil", points: 0 },
          { value: "50k_500k", label: "R$ 50 mil a R$ 500 mil", points: 1 },
          { value: "500k_2m", label: "R$ 500 mil a R$ 2 milhões", points: 2 },
          { value: "acima_2m", label: "Acima de R$ 2 milhões", points: 3 },
        ],
      },
      {
        key: "segmento", label: "Segmento de atuação", type: "select_input",
        options: SEGMENTO_OPTIONS.map((s) => ({ value: s.toLowerCase(), label: s, points: 0 })),
      },
      {
        key: "qtd_socios", label: "Quantidade de sócios", type: "radio",
        options: [
          { value: "1", label: "1", points: 0 },
          { value: "2-3", label: "2 a 3", points: 1 },
          { value: "4+", label: "4 ou mais", points: 2 },
        ],
      },
      {
        key: "distribuicao_societaria", label: "Distribuição societária", type: "radio",
        options: [
          { value: "igualitaria", label: "Igualitária", points: 0 },
          { value: "majoritario", label: "Majoritário único", points: 1 },
          { value: "complexa", label: "Complexa / múltiplos blocos", points: 2 },
        ],
      },
      {
        key: "responsavel_financeiro", label: "Existe responsável formal pelo financeiro?", type: "radio",
        options: [
          { value: "sim", label: "Sim", points: 1 },
          { value: "nao", label: "Não", points: 0 },
        ],
      },
      {
        key: "cargo_responsavel", label: "Qual o cargo do responsável financeiro?", type: "radio",
        conditional: { key: "responsavel_financeiro", value: "sim" },
        options: [
          { value: "administrador", label: "Administrador / Sócio", points: 1 },
          { value: "gerente", label: "Gerente Financeiro", points: 2 },
          { value: "cfo", label: "CFO / Diretor Financeiro", points: 3 },
        ],
      },
      {
        key: "equipe_financeira", label: "Qual o tamanho da equipe financeira?", type: "radio",
        options: [
          { value: "nenhum", label: "Não existe", points: 0 },
          { value: "1", label: "1 pessoa", points: 1 },
          { value: "2-5", label: "2 a 5 pessoas", points: 2 },
          { value: "6+", label: "6 ou mais", points: 3 },
        ],
      },
      {
        key: "qtd_bancos", label: "Quantos bancos a empresa utiliza?", type: "radio",
        options: [
          { value: "1", label: "1", points: 1 },
          { value: "2-3", label: "2 a 3", points: 2 },
          { value: "4+", label: "4 ou mais", points: 3 },
        ],
      },
      {
        key: "qtd_contas_bancarias", label: "Quantas contas bancárias existem no total?", type: "number_input",
        options: [],
      },
    ],
  },
  {
    key: "maturidade", label: "Maturidade Financeira", icon: "BarChart3", order: 1, max_points: 40,
    questions: [
      { key: "controle_caixa", label: "Como o fluxo de caixa é controlado?", type: "radio", options: [
        { value: "nenhum", label: "Não existe controle", points: 0 },
        { value: "planilha", label: "Planilha simples", points: 1 },
        { value: "sistema", label: "Sistema financeiro", points: 2 },
        { value: "erp", label: "ERP", points: 3 },
      ]},
      { key: "projecao_caixa", label: "Existe projeção de fluxo de caixa?", type: "radio", options: [
        { value: "nao", label: "Não existe", points: 0 },
        { value: "30d", label: "Até 30 dias", points: 1 },
        { value: "90d", label: "Até 90 dias", points: 2 },
        { value: "12m", label: "12 meses", points: 3 },
      ]},
      { key: "dre_gerencial", label: "A empresa possui DRE Gerencial?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "anual", label: "Sim, anual", points: 1 },
        { value: "trimestral", label: "Sim, trimestral", points: 2 },
        { value: "mensal", label: "Sim, mensal", points: 3 },
      ]},
      { key: "analise_gestao", label: "Os resultados são analisados pela Gestão?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "ocasionalmente", label: "Ocasionalmente", points: 1 },
        { value: "mensalmente", label: "Mensalmente", points: 2 },
        { value: "semanalmente", label: "Semanalmente", points: 3 },
      ]},
      { key: "classificacao_despesas", label: "As despesas são classificadas?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "parcial", label: "Parcialmente", points: 1 },
        { value: "categoria", label: "Sim, por categoria", points: 2 },
        { value: "plano_contas", label: "Sim, por plano de contas completo", points: 3 },
      ]},
      { key: "centro_custo", label: "Existe controle por centro de custo?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "parcial", label: "Parcial", points: 1 },
        { value: "sim", label: "Sim", points: 2 },
      ]},
      { key: "previsibilidade_receita", label: "Existe previsibilidade de Receita?", type: "radio", options: [
        { value: "baixa", label: "Baixa (vendas pontuais)", points: 0 },
        { value: "parcial", label: "Parcial", points: 1 },
        { value: "alta", label: "Alta (contratos recorrentes)", points: 2 },
      ]},
      { key: "monitoramento_recorrencia", label: "Receitas recorrentes são monitoradas?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "parcial", label: "Parcial", points: 1 },
        { value: "sim", label: "Sim", points: 2 },
      ]},
      { key: "gestao_inadimplencia", label: "Existe Gestão de Inadimplência?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "parcial", label: "Parcial", points: 1 },
        { value: "sim_interna", label: "Sim, interna", points: 2 },
        { value: "sim_terceirizada", label: "Sim, terceirizada", points: 3 },
      ]},
      { key: "nivel_inadimplencia", label: "Qual o sentimento em relação ao nível de Inadimplência observado?", type: "radio", options: [
        { value: "baixo", label: "Baixo", points: 2 },
        { value: "medio", label: "Médio", points: 1 },
        { value: "alto", label: "Alto", points: 0 },
      ]},
    ],
  },
  {
    key: "sistema", label: "Sistema Financeiro", icon: "FileText", order: 2, max_points: 25,
    questions: [
      { key: "usa_erp", label: "A empresa utiliza ERP?", type: "radio", options: [
        { value: "sim", label: "Sim", points: 2 },
        { value: "nao", label: "Não", points: 0 },
      ]},
      { key: "qual_erp", label: "Qual ERP?", type: "select_input", conditional: { key: "usa_erp", value: "sim" }, options: [
        { value: "conta_azul", label: "Conta Azul", points: 0 },
        { value: "omie", label: "Omie", points: 0 },
        { value: "bling", label: "Bling", points: 0 },
        { value: "sap", label: "SAP", points: 0 },
        { value: "totvs", label: "TOTVS", points: 0 },
        { value: "outro", label: "Outro", points: 0 },
      ]},
      { key: "contas_pagar", label: "Contas a pagar são controladas em:", type: "radio", options: [
        { value: "nenhum", label: "Não existe controle", points: 0 },
        { value: "planilha", label: "Planilha", points: 1 },
        { value: "sistema", label: "Sistema financeiro (DDA do banco)", points: 2 },
        { value: "erp", label: "ERP", points: 3 },
      ]},
      { key: "contas_receber", label: "Contas a receber são controladas em:", type: "radio", options: [
        { value: "nenhum", label: "Não existe controle", points: 0 },
        { value: "planilha", label: "Planilha", points: 1 },
        { value: "sistema", label: "Sistema financeiro (App de Cobrança ou Banco)", points: 2 },
        { value: "erp", label: "ERP", points: 3 },
      ]},
      { key: "conciliacao_bancaria", label: "Conciliação bancária é feita?", type: "radio", options: [
        { value: "nunca", label: "Nunca", points: 0 },
        { value: "eventualmente", label: "Eventualmente", points: 1 },
        { value: "contabilidade", label: "Somente pela contabilidade", points: 2 },
        { value: "mensalmente", label: "Mensalmente", points: 3 },
        { value: "diariamente", label: "Diariamente", points: 4 },
      ]},
    ],
  },
  {
    key: "tecnologia", label: "Tecnologia", icon: "Cpu", order: 3, max_points: 15,
    questions: [
      { key: "importacao_extratos", label: "Como os extratos bancários são importados?", type: "radio", options: [
        { value: "nao_importados", label: "Não são importados", points: 0 },
        { value: "manualmente", label: "Manualmente", points: 1 },
        { value: "automaticamente", label: "Automaticamente", points: 2 },
      ]},
      { key: "integracao_sistemas", label: "Dados financeiros são integrados entre os sistemas?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "parcialmente", label: "Parcialmente", points: 1 },
        { value: "sim", label: "Sim", points: 3 },
      ]},
      { key: "dashboard_financeiro", label: "A empresa utiliza Dashboard financeiro?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "planilhas", label: "Planilhas e relatórios manuais", points: 1 },
        { value: "bi", label: "BI", points: 2 },
        { value: "sistema", label: "Sistema", points: 3 },
      ]},
      { key: "indicadores_financeiros", label: "Existem Indicadores Financeiros Monitorados?", type: "radio", options: [
        { value: "nao", label: "Não", points: 0 },
        { value: "alguns", label: "Alguns", points: 1 },
        { value: "sim", label: "Sim, vários", points: 2 },
      ]},
    ],
  },
];

const FALLBACK_THRESHOLDS = [
  { level: 1, label: "Controle básico", min_score: 0, max_score: 20 },
  { level: 2, label: "Financeiro estruturado", min_score: 21, max_score: 40 },
  { level: 3, label: "Controladoria", min_score: 41, max_score: 60 },
  { level: 4, label: "Governança financeira", min_score: 61, max_score: 80 },
  { level: 5, label: "Gestão orientada por dados", min_score: 81, max_score: 100 },
];

const FALLBACK_COMPLEXITY_THRESHOLDS = [
  { min: 0, max: 25, label: "Baixa", color: "text-green-600 border-green-400 bg-green-50" },
  { min: 26, max: 50, label: "Média", color: "text-yellow-600 border-yellow-400 bg-yellow-50" },
  { min: 51, max: 75, label: "Alta", color: "text-orange-600 border-orange-400 bg-orange-50" },
  { min: 76, max: 100, label: "Muito Alta", color: "text-red-600 border-red-400 bg-red-50" },
];

function getComplexityBadge(pct: number, complexityThresholds: any[]) {
  const t = complexityThresholds.find((th) => pct >= th.min && pct <= th.max) || complexityThresholds[0];
  return t;
}

function calcSectionScore(section: any, answers: Record<string, string>): number {
  let score = 0;
  for (const q of section.questions) {
    if (q.conditional && answers[q.conditional.key] !== q.conditional.value) continue;
    const val = answers[q.key];
    if (!val) continue;
    if (q.type === "number_input" || q.key === "qtd_contas_bancarias") {
      score += calcContasBancariasScore(val);
    } else {
      const opt = q.options?.find((o: any) => o.value === val);
      if (opt) score += (opt.points ?? 0);
    }
  }
  return score;
}

function calcSectionMaxPoints(section: any): number {
  if (section.max_points) return section.max_points;
  let max = 0;
  for (const q of section.questions) {
    if (q.type === "number_input" || q.key === "qtd_contas_bancarias") {
      max += 5;
    } else {
      const maxOpt = Math.max(...(q.options?.map((o: any) => o.points ?? 0) || [0]));
      max += maxOpt;
    }
  }
  return max;
}

export function Step1Diagnostico({ data, onChange }: Props) {
  const { getStepConfig, isLoading } = useOnboardingConfig();
  const [answers, setAnswers] = useState<Record<string, string>>(data?.answers || {});

  const stepConfig = getStepConfig(1);
  const sections = useMemo(() => {
    const s = stepConfig?.sections || FALLBACK_SECTIONS;
    return [...s].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [stepConfig]);
  const thresholds = useMemo(() => stepConfig?.thresholds || FALLBACK_THRESHOLDS, [stepConfig]);
  const complexityThresholds = useMemo(() => stepConfig?.complexity_thresholds || FALLBACK_COMPLEXITY_THRESHOLDS, [stepConfig]);

  const sectionScores = useMemo(() => {
    const scores: Record<string, { score: number; max: number; pct: number }> = {};
    for (const section of sections) {
      const score = calcSectionScore(section, answers);
      const max = calcSectionMaxPoints(section);
      scores[section.key] = { score, max, pct: max > 0 ? Math.round((score / max) * 100) : 0 };
    }
    return scores;
  }, [answers, sections]);

  const totalScore = useMemo(() => {
    return Object.values(sectionScores).reduce((sum, s) => sum + s.score, 0);
  }, [sectionScores]);

  const totalMax = useMemo(() => {
    return Object.values(sectionScores).reduce((sum, s) => sum + s.max, 0);
  }, [sectionScores]);

  const totalPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  const maturityLevel = useMemo(() => {
    for (const t of [...thresholds].sort((a: any, b: any) => b.level - a.level)) {
      if (totalPct >= t.min_score) return t.level;
    }
    return 1;
  }, [totalPct, thresholds]);

  const maturityLabel = useMemo(() => {
    const t = thresholds.find((th: any) => th.level === maturityLevel);
    return t?.label || "";
  }, [maturityLevel, thresholds]);

  useEffect(() => {
    onChange({ answers, maturity_level: maturityLevel, total_score: totalScore, total_pct: totalPct });
  }, [answers]);

  const set = (key: string, val: string) => setAnswers((prev) => ({ ...prev, [key]: val }));

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const answeredKeys = Object.keys(answers).filter(k => answers[k]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Diagnóstico Inicial</h2>
        <p className="text-muted-foreground mt-1">Avalie o nível de maturidade e complexidade financeira da sua empresa</p>
      </div>

      <Accordion type="single" collapsible defaultValue={sections[0]?.key} className="space-y-3">
        {sections.map((section: any) => {
          const Icon = ICON_MAP[section.icon] || FileText;
          const visibleQuestions = section.questions.filter((q: any) =>
            !q.conditional || answers[q.conditional.key] === q.conditional.value
          );
          const answeredCount = visibleQuestions.filter((q: any) => answers[q.key]).length;
          const ss = sectionScores[section.key] || { score: 0, max: 0, pct: 0 };
          const complexity = getComplexityBadge(ss.pct, complexityThresholds);

          return (
            <AccordionItem key={section.key} value={section.key} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon size={18} className="text-primary" />
                  <span className="font-medium">{section.label}</span>
                  <Badge variant={answeredCount === visibleQuestions.length && answeredCount > 0 ? "default" : "secondary"}>
                    {answeredCount}/{visibleQuestions.length}
                  </Badge>
                  {answeredCount > 0 && ss.score > 0 && (
                    <Badge variant="outline" className={complexity.color}>
                      {ss.score}/{ss.max} pts — {complexity.label}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 py-1">
                  {section.questions.map((q: any) => {
                    if (q.conditional && answers[q.conditional.key] !== q.conditional.value) {
                      return null;
                    }

                    if (q.type === "number_input") {
                      return (
                        <div key={q.key} className="space-y-2">
                          <Label>{q.label}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={50}
                            placeholder="Ex: 3"
                            value={answers[q.key] || ""}
                            onChange={(e) => set(q.key, e.target.value)}
                            className="max-w-[200px]"
                          />
                          {answers[q.key] && parseInt(answers[q.key]) > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Score: {calcContasBancariasScore(answers[q.key])} ponto(s) (máx. 5)
                            </p>
                          )}
                        </div>
                      );
                    }

                    if (q.type === "select_input") {
                      return (
                        <div key={q.key} className="space-y-2">
                          <Label>{q.label}</Label>
                          <div className="flex flex-wrap gap-2">
                            {q.options.map((opt: any) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => set(q.key, opt.value)}
                                className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                                  answers[q.key] === opt.value
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-foreground border-input hover:bg-accent"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {answers[q.key] === "outro" && (
                            <Input
                              placeholder="Especifique"
                              value={answers[`${q.key}_outro`] || ""}
                              onChange={(e) => set(`${q.key}_outro`, e.target.value)}
                              className="mt-2 max-w-[300px]"
                            />
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={q.key} className="space-y-2">
                        <Label>{q.label}</Label>
                        <RadioGroup value={answers[q.key] || ""} onValueChange={(v) => set(q.key, v)}>
                          {q.options.map((opt: any, oIdx: number) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.value} id={`${q.key}-${opt.value}`} />
                              <Label htmlFor={`${q.key}-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    );
                  })}

                  {answeredCount >= 2 && ss.score > 0 && (
                    <Card className={`border mt-4 ${complexity.color}`}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={16} />
                            <span className="text-sm font-medium">{section.label}</span>
                          </div>
                          <Badge variant="outline" className={complexity.color}>
                            {ss.score}/{ss.max} pts — {complexity.label}
                          </Badge>
                        </div>
                        <Progress value={ss.pct} className="mt-2 h-2" />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {answeredKeys.length >= 5 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-4">
            {/* Section breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sections.map((section: any) => {
                const ss = sectionScores[section.key] || { score: 0, max: 0, pct: 0 };
                const Icon = ICON_MAP[section.icon] || FileText;
                return (
                  <div key={section.key} className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Icon size={14} />
                      <span className="text-xs">{section.label}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{ss.score}<span className="text-sm font-normal text-muted-foreground">/{ss.max}</span></p>
                    <Progress value={ss.pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Total — Nível de Maturidade</p>
                <p className="text-xl font-bold text-foreground">
                  Nível {maturityLevel} — {maturityLabel}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{totalScore} de {totalMax} pontos ({totalPct}%)</p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2 border-primary text-primary">
                {maturityLevel}/5
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
