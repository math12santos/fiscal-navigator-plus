import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Circle, LayoutDashboard, BarChart3, Wallet, Target, Users, Rocket,
} from "lucide-react";
import { StepHeader } from "./StepHeader";

interface Props {
  data: Record<string, any>;
  completedSteps: number[];
  onActivate: () => void;
  cockpitActivated: boolean;
}

const READINESS_ITEMS = [
  { step: 1, label: "Diagnóstico de maturidade", icon: CheckCircle2 },
  { step: 2, label: "Estrutura organizacional", icon: Users },
  { step: 4, label: "Plano de contas e centros de custo", icon: Wallet },
  { step: 5, label: "Contratos cadastrados", icon: Target },
  { step: 6, label: "Planejamento financeiro", icon: BarChart3 },
  { step: 7, label: "Rotinas financeiras", icon: CheckCircle2 },
];

const DASHBOARDS = [
  { title: "Dashboard CFO", description: "Caixa, runway, MRR, margem, burn rate", icon: LayoutDashboard },
  { title: "Dashboard Board", description: "Saúde financeira, projeção, riscos", icon: BarChart3 },
  { title: "Fluxo de Caixa", description: "Entradas, saídas, projeções diárias", icon: Wallet },
  { title: "Planejamento", description: "Orçamento, cenários, desvios", icon: Target },
];

export function Step8Cockpit({ completedSteps, onActivate, cockpitActivated }: Props) {
  const readyCount = READINESS_ITEMS.filter((i) => completedSteps.includes(i.step)).length;

  return (
    <div className="space-y-6">
      <StepHeader
        stepNumber={8}
        fallbackTitle="Ativação do Cockpit"
        fallbackDescription="Libere os dashboards financeiros do seu cockpit de gestão."
        fallbackIcon={LayoutDashboard}
      />

      {/* Readiness checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo de Prontidão</CardTitle>
          <CardDescription>
            {readyCount} de {READINESS_ITEMS.length} etapas concluídas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {READINESS_ITEMS.map((item) => {
            const done = completedSteps.includes(item.step);
            return (
              <div key={item.step} className="flex items-center gap-3 text-sm">
                {done ? (
                  <CheckCircle2 size={18} className="text-primary shrink-0" />
                ) : (
                  <Circle size={18} className="text-muted-foreground/40 shrink-0" />
                )}
                <span className={done ? "text-foreground" : "text-muted-foreground"}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dashboard previews */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Dashboards que serão ativados</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DASHBOARDS.map((d) => (
            <Card key={d.title} className={cockpitActivated ? "border-primary/30 bg-primary/5" : ""}>
              <CardContent className="p-4 flex items-start gap-3">
                <d.icon size={20} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Activation */}
      {cockpitActivated ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <Rocket size={20} className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Cockpit Ativado!</p>
            <p className="text-xs text-muted-foreground">
              Todos os dashboards financeiros estão disponíveis no menu principal.
            </p>
          </div>
          <Badge className="ml-auto">Ativo</Badge>
        </div>
      ) : (
        <Button onClick={onActivate} size="lg" className="w-full gap-2">
          <Rocket size={18} />
          Ativar Cockpit Financeiro
        </Button>
      )}
    </div>
  );
}
