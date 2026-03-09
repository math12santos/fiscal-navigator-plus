import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, BarChart3, FileText, Cpu, Target, Wallet, Plug, CalendarCheck, LayoutDashboard, Lightbulb, ShieldCheck, Trophy, Database } from "lucide-react";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { type LucideIcon } from "lucide-react";

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Building2, BarChart3, FileText, Cpu, Target, Wallet, Plug, CalendarCheck, LayoutDashboard, Lightbulb, ShieldCheck, Trophy, Database,
};

// Hardcoded fallback
const FALLBACK_SECTIONS = [
  {
    key: "estrutura", label: "Estrutura", icon: "Building2", order: 0,
    questions: [
      { key: "num_empresas", label: "Quantas empresas existem no grupo?", options: [{ value: "1", label: "1", points: 0 }, { value: "2-5", label: "2 a 5", points: 1 }, { value: "6+", label: "6 ou mais", points: 2 }] },
      { key: "tem_holding", label: "Existe holding?", options: [{ value: "sim", label: "Sim", points: 1 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "num_cnpjs", label: "Quantos CNPJs existem?", options: [{ value: "1", label: "1", points: 0 }, { value: "2-5", label: "2 a 5", points: 0 }, { value: "6+", label: "6 ou mais", points: 0 }] },
    ],
  },
  {
    key: "maturidade", label: "Maturidade do Financeiro", icon: "BarChart3", order: 1,
    questions: [
      { key: "controle_caixa", label: "Como o fluxo de caixa é controlado atualmente?", options: [{ value: "nenhum", label: "Sem controle", points: 0 }, { value: "planilha", label: "Planilha", points: 1 }, { value: "erp", label: "ERP", points: 2 }] },
    ],
  },
  {
    key: "sistema", label: "Sistema Financeiro", icon: "FileText", order: 2,
    questions: [
      { key: "auditoria", label: "Existe processo de auditoria dos pagamentos?", options: [{ value: "sim", label: "Sim", points: 2 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "dre", label: "Existe DRE gerencial mensal?", options: [{ value: "nao", label: "Não existe controle", points: 0 }, { value: "gerencial", label: "Sim, DRE gerencial", points: 2 }, { value: "integrada", label: "Sim, integrada à DRE contábil", points: 3 }] },
    ],
  },
  {
    key: "tecnologia", label: "Tecnologia", icon: "Cpu", order: 3,
    questions: [
      { key: "usa_erp", label: "Utiliza algum ERP?", options: [{ value: "sim", label: "Sim", points: 1 }, { value: "nao", label: "Não", points: 0 }] },
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
      for (const q of section.questions) {
        const selected = answers[q.key];
        if (selected) {
          const opt = q.options.find((o: any) => o.value === selected);
          if (opt) score += (opt.points ?? 0);
        }
      }
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
        <p className="text-muted-foreground mt-1">Avalie o nível de maturidade financeira da sua empresa</p>
      </div>

      {sections.map((section: any) => {
        const Icon = ICON_MAP[section.icon] || FileText;
        return (
          <Card key={section.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon size={18} className="text-primary" /> {section.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.questions.map((q: any) => (
                <div key={q.key} className="space-y-2">
                  <Label>{q.label}</Label>
                  <RadioGroup value={answers[q.key] || ""} onValueChange={(v) => set(q.key, v)}>
                    {q.options.map((opt: any, oIdx: number) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`${q.key}-${opt.value}`} />
                        <Label htmlFor={`${q.key}-${opt.value}`}>{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

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
