import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, ShieldCheck, BarChart3, Target, Database, FileText, Building2, Cpu, Wallet, Plug, CalendarCheck, LayoutDashboard, Lightbulb, Loader2 } from "lucide-react";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { type LucideIcon } from "lucide-react";

interface Props {
  data: Record<string, any>;
  completedSteps: number[];
  onChange: (data: Record<string, any>) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck, Target, BarChart3, Trophy, Database, FileText, Building2, Cpu, Wallet, Plug, CalendarCheck, LayoutDashboard, Lightbulb,
};

const FALLBACK_DIMENSIONS = [
  { key: "controle", label: "Controle Financeiro", icon: "ShieldCheck", color: "text-emerald-500", steps: [1, 4] },
  { key: "planejamento", label: "Planejamento", icon: "Target", color: "text-blue-500", steps: [6] },
  { key: "governanca", label: "Governança", icon: "BarChart3", color: "text-violet-500", steps: [5, 7] },
  { key: "previsibilidade", label: "Previsibilidade", icon: "Trophy", color: "text-amber-500", steps: [6, 8] },
  { key: "qualidade", label: "Qualidade dos Dados", icon: "Database", color: "text-cyan-500", steps: [3, 4] },
];

const FALLBACK_THRESHOLDS = [
  { label: "Bronze", min_pct: 0 },
  { label: "Prata", min_pct: 40 },
  { label: "Ouro", min_pct: 60 },
  { label: "Board Ready", min_pct: 80 },
];

const SCORE_COLORS: Record<string, string> = {
  "Bronze": "bg-orange-500/10 text-orange-600 border-orange-500/30",
  "Prata": "bg-slate-400/10 text-slate-500 border-slate-400/30",
  "Ouro": "bg-amber-500/10 text-amber-600 border-amber-500/30",
  "Board Ready": "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

export function Step10Score({ data, completedSteps, onChange }: Props) {
  const { getStepConfig, isLoading } = useOnboardingConfig();
  const stepConfig = getStepConfig(10);

  const configDimensions = useMemo(() => stepConfig?.dimensions || FALLBACK_DIMENSIONS, [stepConfig]);
  const configThresholds = useMemo(() => stepConfig?.thresholds || FALLBACK_THRESHOLDS, [stepConfig]);

  const dimensions = useMemo(() => {
    const result: Record<string, number> = {};
    for (const dim of configDimensions) {
      const steps = dim.steps || [];
      const completed = steps.filter((s: number) => completedSteps.includes(s)).length;
      result[dim.key] = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
    }
    return result;
  }, [completedSteps, configDimensions]);

  const avgScore = useMemo(() => {
    const vals = Object.values(dimensions);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [dimensions]);

  const scoreLabel = useMemo(() => {
    const sorted = [...configThresholds].sort((a: any, b: any) => b.min_pct - a.min_pct);
    for (const t of sorted) {
      if (avgScore >= t.min_pct) return t.label;
    }
    return sorted[sorted.length - 1]?.label || "Bronze";
  }, [avgScore, configThresholds]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Score de Maturidade Financeira</h2>
        <p className="text-muted-foreground mt-1">Avaliação baseada na completude das informações configuradas</p>
      </div>

      <Card className="border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Score Geral</p>
              <p className="text-4xl font-bold text-foreground">{avgScore}%</p>
            </div>
            <Badge variant="outline" className={`text-lg px-5 py-2.5 ${SCORE_COLORS[scoreLabel] || ""}`}>
              {scoreLabel}
            </Badge>
          </div>
          <Progress value={avgScore} className="mt-4 h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configDimensions.map((dim: any) => {
          const Icon = ICON_MAP[dim.icon] || Target;
          return (
            <Card key={dim.key}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <Icon size={20} className={dim.color} />
                  <span className="font-medium text-foreground">{dim.label}</span>
                  <span className="ml-auto text-lg font-bold text-foreground">{dimensions[dim.key] ?? 0}%</span>
                </div>
                <Progress value={dimensions[dim.key] ?? 0} className="h-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p>
            Complete mais etapas do onboarding para aumentar seu score. Empresas com classificação
            <strong className="text-foreground"> Board Ready </strong>
            possuem dados suficientes para gerar relatórios confiáveis para investidores e conselheiros.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
