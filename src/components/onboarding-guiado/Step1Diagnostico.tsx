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

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Building2, BarChart3, FileText, Cpu, Target, Wallet, Plug, CalendarCheck, LayoutDashboard, Lightbulb, ShieldCheck, Trophy, Database, TrendingUp,
};

const SEGMENTO_OPTIONS = ["Comércio", "Serviços", "Indústria", "Tecnologia", "Outro"];

// Scoring for contas bancárias: 1 point per account, +2 per account above 5
function calcContasBancariasScore(val: string): number {
  const n = parseInt(val, 10);
  if (isNaN(n) || n <= 0) return 0;
  if (n <= 5) return n;
  return 5 + (n - 5) * 2;
}

const FALLBACK_SECTIONS = [
  {
    key: "estrutura", label: "Estrutura Societária e Porte", icon: "Building2", order: 0,
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
          { value: "sim", label: "Sim", points: 0 },
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
          { value: "1", label: "1", points: 0 },
          { value: "2-3", label: "2 a 3", points: 1 },
          { value: "4+", label: "4 ou mais", points: 4 },
        ],
      },
      {
        key: "qtd_contas_bancarias", label: "Quantas contas bancárias existem no total?", type: "number_input",
        options: [],
      },
    ],
  },
  {
    key: "maturidade", label: "Maturidade do Financeiro", icon: "BarChart3", order: 1,
    questions: [
      { key: "controle_caixa", label: "Como o fluxo de caixa é controlado atualmente?", type: "radio", options: [{ value: "nenhum", label: "Sem controle", points: 0 }, { value: "planilha", label: "Planilha", points: 1 }, { value: "erp", label: "ERP", points: 2 }] },
    ],
  },
  {
    key: "sistema", label: "Sistema Financeiro", icon: "FileText", order: 2,
    questions: [
      { key: "auditoria", label: "Existe processo de auditoria dos pagamentos?", type: "radio", options: [{ value: "sim", label: "Sim", points: 2 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "dre", label: "Existe DRE gerencial mensal?", type: "radio", options: [{ value: "nao", label: "Não existe controle", points: 0 }, { value: "gerencial", label: "Sim, DRE gerencial", points: 2 }, { value: "integrada", label: "Sim, integrada à DRE contábil", points: 3 }] },
    ],
  },
  {
    key: "tecnologia", label: "Tecnologia", icon: "Cpu", order: 3,
    questions: [
      { key: "usa_erp", label: "Utiliza algum ERP?", type: "radio", options: [{ value: "sim", label: "Sim", points: 1 }, { value: "nao", label: "Não", points: 0 }] },
    ],
  },
];

const FALLBACK_THRESHOLDS = [
  { level: 1, label: "Controle básico", min_score: 0, max_score: 2 },
  { level: 2, label: "Financeiro estruturado", min_score: 3, max_score: 4 },
  { level: 3, label: "Controladoria", min_score: 5, max_score: 6 },
  { level: 4, label: "Governança financeira", min_score: 7, max_score: 8 },
  { level: 5, label: "Gestão orientada por dados", min_score: 9, max_score: 99 },
];

const COMPLEXITY_THRESHOLDS = [
  { min: 0, max: 3, label: "Baixa", color: "text-green-600 border-green-400 bg-green-50" },
  { min: 4, max: 6, label: "Média", color: "text-yellow-600 border-yellow-400 bg-yellow-50" },
  { min: 7, max: 9, label: "Alta", color: "text-orange-600 border-orange-400 bg-orange-50" },
  { min: 10, max: 999, label: "Muito Alta", color: "text-red-600 border-red-400 bg-red-50" },
];

function getComplexityBadge(score: number) {
  const t = COMPLEXITY_THRESHOLDS.find((th) => score >= th.min && score <= th.max) || COMPLEXITY_THRESHOLDS[0];
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

export function Step1Diagnostico({ data, onChange }: Props) {
  const { getStepConfig, isLoading } = useOnboardingConfig();
  const [answers, setAnswers] = useState<Record<string, string>>(data?.answers || {});

  const stepConfig = getStepConfig(1);
  const sections = useMemo(() => {
    const s = stepConfig?.sections || FALLBACK_SECTIONS;
    return [...s].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [stepConfig]);
  const thresholds = useMemo(() => stepConfig?.thresholds || FALLBACK_THRESHOLDS, [stepConfig]);

  const maturityLevel = useMemo(() => {
    let score = 0;
    for (const section of sections) {
      score += calcSectionScore(section, answers);
    }
    for (const t of [...thresholds].sort((a: any, b: any) => b.level - a.level)) {
      if (score >= t.min_score) return t.level;
    }
    return 1;
  }, [answers, sections, thresholds]);

  const maturityLabel = useMemo(() => {
    const t = thresholds.find((th: any) => th.level === maturityLevel);
    return t?.label || "";
  }, [maturityLevel, thresholds]);

  useEffect(() => {
    onChange({ answers, maturity_level: maturityLevel });
  }, [answers]);

  const set = (key: string, val: string) => setAnswers((prev) => ({ ...prev, [key]: val }));

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

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
          const sectionScore = calcSectionScore(section, answers);
          const complexity = getComplexityBadge(sectionScore);

          return (
            <AccordionItem key={section.key} value={section.key} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon size={18} className="text-primary" />
                  <span className="font-medium">{section.label}</span>
                  <Badge variant={answeredCount === visibleQuestions.length && answeredCount > 0 ? "default" : "secondary"}>
                    {answeredCount}/{visibleQuestions.length}
                  </Badge>
                  {answeredCount > 0 && sectionScore > 0 && (
                    <Badge variant="outline" className={complexity.color}>
                      {complexity.label}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 py-1">
                  {section.questions.map((q: any) => {
                    // Conditional visibility
                    if (q.conditional && answers[q.conditional.key] !== q.conditional.value) {
                      return null;
                    }

                    // Number input (contas bancárias)
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
                              Score: {calcContasBancariasScore(answers[q.key])} ponto(s)
                            </p>
                          )}
                        </div>
                      );
                    }

                    // Select with free input (segmento)
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
                              placeholder="Especifique o segmento"
                              value={answers["segmento_outro"] || ""}
                              onChange={(e) => set("segmento_outro", e.target.value)}
                              className="mt-2 max-w-[300px]"
                            />
                          )}
                        </div>
                      );
                    }

                    // Default: radio
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

                  {/* Section complexity score card */}
                  {answeredCount >= 2 && sectionScore > 0 && (
                    <Card className={`border mt-4 ${complexity.color}`}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={16} />
                            <span className="text-sm font-medium">Complexidade da {section.label}</span>
                          </div>
                          <Badge variant="outline" className={complexity.color}>
                            {sectionScore} pts — {complexity.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {Object.keys(answers).length >= 3 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nível de Maturidade Estimado</p>
                <p className="text-xl font-bold text-foreground">
                  Nível {maturityLevel} — {maturityLabel}
                </p>
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
