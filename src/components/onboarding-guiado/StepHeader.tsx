import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { type LucideIcon, FileText, Building2, Plug, Wallet, Target, CalendarCheck, LayoutDashboard, Lightbulb } from "lucide-react";
import { CheckCircle2, Circle } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Building2, Plug, Wallet, FileText, Target, CalendarCheck, LayoutDashboard, Lightbulb,
};

interface StepHeaderProps {
  stepNumber: number;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackIcon: LucideIcon;
}

export function StepHeader({ stepNumber, fallbackTitle, fallbackDescription, fallbackIcon: FallbackIcon }: StepHeaderProps) {
  const { getStepConfig } = useOnboardingConfig();
  const config = getStepConfig(stepNumber);

  const title = config?.title || fallbackTitle;
  const description = config?.description || fallbackDescription;
  const iconName = config?.icon;
  const Icon = (iconName && ICON_MAP[iconName]) || FallbackIcon;
  const items: string[] = config?.items || [];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Checklist da etapa</p>
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Circle size={12} className="shrink-0 text-muted-foreground/40" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
