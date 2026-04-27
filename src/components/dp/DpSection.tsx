import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { LucideIcon } from "lucide-react";

interface DpSectionProps {
  /** Optional icon shown before the title. */
  icon?: LucideIcon;
  /** Section title — short, descriptive (e.g. "Visão Geral"). */
  title: string;
  /** Optional one-liner describing the section purpose. */
  description?: string;
  /** Optional actions rendered on the right side of the header. */
  actions?: ReactNode;
  /** Visual variant. */
  variant?: "default" | "compact" | "highlighted";
  /** Section content. */
  children: ReactNode;
  className?: string;
}

/**
 * Standard section wrapper used across the DP module to bring visual
 * hierarchy and consistent rhythm. Always provides a clear title row +
 * separator so dense content (KPIs, tables, forms) doesn't melt together.
 */
export function DpSection({
  icon: Icon,
  title,
  description,
  actions,
  variant = "default",
  children,
  className,
}: DpSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border",
        variant === "highlighted" ? "bg-muted/30" : "bg-card",
        variant === "compact" ? "p-4" : "p-5",
        className,
      )}
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon && (
            <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon size={15} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </header>

      <Separator className="my-4" />

      <div className={cn(variant === "compact" ? "space-y-3" : "space-y-4")}>
        {children}
      </div>
    </section>
  );
}

export default DpSection;
