import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, ShieldCheck, BarChart3, Target, Database } from "lucide-react";

interface Props {
  data: Record<string, any>;
  completedSteps: number[];
  onChange: (data: Record<string, any>) => void;
}

const DIMENSIONS = [
  { key: "controle", label: "Controle Financeiro", icon: ShieldCheck, color: "text-emerald-500" },
  { key: "planejamento", label: "Planejamento", icon: Target, color: "text-blue-500" },
  { key: "governanca", label: "Governança", icon: BarChart3, color: "text-violet-500" },
  { key: "previsibilidade", label: "Previsibilidade", icon: Trophy, color: "text-amber-500" },
  { key: "qualidade", label: "Qualidade dos Dados", icon: Database, color: "text-cyan-500" },
];

function getScoreLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Board Ready", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
  if (pct >= 60) return { label: "Ouro", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
  if (pct >= 40) return { label: "Prata", color: "bg-slate-400/10 text-slate-500 border-slate-400/30" };
  return { label: "Bronze", color: "bg-orange-500/10 text-orange-600 border-orange-500/30" };
}

export function Step10Score({ data, completedSteps, onChange }: Props) {
  const dimensions = useMemo(() => {
    const stepsForDim: Record<string, number[]> = {
      controle: [1, 4],
      planejamento: [6],
      governanca: [5, 7],
      previsibilidade: [6, 8],
      qualidade: [3, 4],
    };

    const result: Record<string, number> = {};
    for (const [dim, steps] of Object.entries(stepsForDim)) {
      const completed = steps.filter((s) => completedSteps.includes(s)).length;
      result[dim] = Math.round((completed / steps.length) * 100);
    }
    return result;
  }, [completedSteps]);

  const avgScore = useMemo(() => {
    const vals = Object.values(dimensions);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [dimensions]);

  const scoreInfo = getScoreLabel(avgScore);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Score de Maturidade Financeira</h2>
        <p className="text-muted-foreground mt-1">
          Avaliação baseada na completude das informações configuradas
        </p>
      </div>

      {/* Score geral */}
      <Card className="border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Score Geral</p>
              <p className="text-4xl font-bold text-foreground">{avgScore}%</p>
            </div>
            <Badge variant="outline" className={`text-lg px-5 py-2.5 ${scoreInfo.color}`}>
              {scoreInfo.label}
            </Badge>
          </div>
          <Progress value={avgScore} className="mt-4 h-3" />
        </CardContent>
      </Card>

      {/* Dimensões */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DIMENSIONS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={20} className={color} />
                <span className="font-medium text-foreground">{label}</span>
                <span className="ml-auto text-lg font-bold text-foreground">
                  {dimensions[key] ?? 0}%
                </span>
              </div>
              <Progress value={dimensions[key] ?? 0} className="h-2" />
            </CardContent>
          </Card>
        ))}
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
