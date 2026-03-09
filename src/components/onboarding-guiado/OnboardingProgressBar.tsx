import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { num: 1, label: "Diagnóstico" },
  { num: 2, label: "Estrutura" },
  { num: 3, label: "Integrações" },
  { num: 4, label: "Financeiro" },
  { num: 5, label: "Contratos" },
  { num: 6, label: "Planejamento" },
  { num: 7, label: "Rotinas" },
  { num: 8, label: "Cockpit" },
  { num: 9, label: "Assistida" },
  { num: 10, label: "Score" },
];

interface Props {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

export function OnboardingProgressBar({ currentStep, completedSteps, onStepClick }: Props) {
  const pct = Math.round((completedSteps.length / STEPS.length) * 100);

  return (
    <div className="w-full space-y-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Progresso do Onboarding</span>
        <span className="font-semibold text-foreground">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between gap-1">
        {STEPS.map((step, i) => {
          const isCompleted = completedSteps.includes(step.num);
          const isCurrent = currentStep === step.num;

          return (
            <button
              key={step.num}
              onClick={() => onStepClick(step.num)}
              className={cn(
                "flex flex-col items-center gap-1 group transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1",
                isCurrent && "scale-105"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary/20 text-primary border-2 border-primary"
                    : "bg-secondary text-muted-foreground group-hover:bg-accent"
                )}
              >
                {isCompleted ? <Check size={14} /> : step.num}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-tight text-center hidden md:block max-w-[60px]",
                  isCurrent ? "text-primary font-semibold" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
