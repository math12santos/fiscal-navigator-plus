// Visualização da trilha de melhoria sugerida automaticamente a partir do checklist.

import { ArrowRight, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  EFFORT_META,
  ImprovementStep,
  buildImprovementTrack,
} from "@/lib/sectorMaturity/improvementTrack";
import {
  MATURITY_LABEL_META,
  SectorMaturityResult,
} from "@/lib/sectorMaturity/types";

interface Props {
  result: SectorMaturityResult;
  onStepAction?: (step: ImprovementStep) => void;
  readOnly?: boolean;
}

export function ImprovementTrack({ result, onStepAction, readOnly }: Props) {
  const track = buildImprovementTrack(result);

  if (track.totalPotential === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-6 text-center space-y-2">
          <Trophy className="mx-auto text-emerald-600" size={28} />
          <p className="text-sm font-semibold text-foreground">
            Setor com maturidade máxima nesta avaliação.
          </p>
          <p className="text-xs text-muted-foreground">
            Continue mantendo as rotinas e atualizações em dia para preservar o score.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner — meta para próxima faixa */}
      {track.nextLabel && track.pointsToNextLabel !== null && track.pointsToNextLabel > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Sparkles className="text-primary shrink-0" size={20} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Faltam <span className="text-primary">{Math.round(track.pointsToNextLabel)} pts</span>{" "}
                para a faixa{" "}
                <Badge variant="outline" className={cn("ml-1", MATURITY_LABEL_META[track.nextLabel].badgeClass)}>
                  {MATURITY_LABEL_META[track.nextLabel].label}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Resolvendo todos os itens abaixo você ganharia até {track.totalPotential} pts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 5 priorizados */}
      {track.topSteps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold text-foreground">Resolva primeiro (melhor ganho/esforço)</h4>
            <span className="text-xs text-muted-foreground">{track.topSteps.length} sugestão(ões)</span>
          </div>
          <ol className="space-y-2">
            {track.topSteps.map((step, idx) => (
              <StepCard
                key={step.key}
                step={step}
                index={idx + 1}
                onStepAction={onStepAction}
                readOnly={readOnly}
              />
            ))}
          </ol>
        </div>
      )}

      {/* Marcos por categoria */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Trilha completa por marco</h4>
        {track.milestones.map((m) => {
          if (m.steps.length === 0) return null;
          return (
            <div key={m.category} className="rounded-md border border-border/60 bg-muted/30 p-3">
              <div className="flex items-baseline justify-between mb-2 gap-2">
                <p className="text-sm font-semibold text-foreground">{m.label}</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  +{m.potentialPoints} pts disponíveis
                </span>
              </div>
              <Progress
                value={Math.min(100, (m.potentialPoints / Math.max(1, track.totalPotential)) * 100)}
                className="h-1 mb-3"
              />
              <ol className="space-y-1.5">
                {m.steps.map((step, idx) => (
                  <StepCard
                    key={step.key}
                    step={step}
                    index={idx + 1}
                    compact
                    onStepAction={onStepAction}
                    readOnly={readOnly}
                  />
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  compact,
  onStepAction,
  readOnly,
}: {
  step: ImprovementStep;
  index: number;
  compact?: boolean;
  onStepAction?: (s: ImprovementStep) => void;
  readOnly?: boolean;
}) {
  const effort = EFFORT_META[step.effort];
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border border-border/60 bg-background p-3",
        compact && "p-2"
      )}
    >
      <span
        className={cn(
          "shrink-0 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs",
          compact ? "w-5 h-5" : "w-6 h-6"
        )}
      >
        {index}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
            {step.label}
          </p>
          <Badge variant="outline" className="text-[10px] py-0 h-4 bg-primary/5 text-primary border-primary/30">
            +{step.potentialPoints} pts
          </Badge>
          <Badge variant="outline" className={cn("text-[10px] py-0 h-4", effort.badgeClass)}>
            {effort.label}
          </Badge>
        </div>
        {(step.detail || step.hint) && (
          <p className="text-xs text-muted-foreground">
            {step.detail && <span className="font-medium text-foreground/80">{step.detail}</span>}
            {step.detail && step.hint && <span> — </span>}
            {step.hint}
          </p>
        )}
      </div>
      {!readOnly && step.ctaTab && onStepAction && (
        <Button size="sm" variant="ghost" className="shrink-0 h-7" onClick={() => onStepAction(step)}>
          Resolver <ArrowRight size={12} className="ml-1" />
        </Button>
      )}
    </li>
  );
}
