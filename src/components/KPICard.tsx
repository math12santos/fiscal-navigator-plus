import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
  icon?: ReactNode;
}

export function KPICard({ title, value, change, subtitle, icon }: KPICardProps) {
  return (
    <div className="glass-card p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold text-foreground animate-count">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {change >= 0 ? (
                <TrendingUp size={14} className="text-success" />
              ) : (
                <TrendingDown size={14} className="text-destructive" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  change >= 0 ? "stat-positive" : "stat-negative"
                )}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}%
              </span>
              {subtitle && (
                <span className="text-xs text-muted-foreground ml-1">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
        )}
      </div>
    </div>
  );
}
