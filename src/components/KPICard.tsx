import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
  icon?: ReactNode;
  /** Group share percentage (0-100), shown as "X% do grupo" */
  groupShare?: number | null;
}

export function KPICard({ title, value, change, subtitle, icon, groupShare }: KPICardProps) {
  return (
    <div className="glass-card p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            {groupShare != null && groupShare > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                {groupShare.toFixed(1)}% do grupo
              </span>
            )}
          </div>
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
          {groupShare != null && groupShare > 0 && (
            <div className="w-full bg-muted/50 rounded-full h-1 mt-1.5">
              <div
                className="bg-primary/60 h-1 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(groupShare, 100)}%` }}
              />
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
