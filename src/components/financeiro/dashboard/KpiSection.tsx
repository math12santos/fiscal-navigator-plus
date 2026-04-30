import { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface KpiSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Quantos KPIs visíveis (para mostrar contador) */
  visibleCount: number;
  totalCount: number;
}

export function KpiSection({ title, subtitle, children, visibleCount, totalCount }: KpiSectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <span className="text-xs text-muted-foreground">
              {visibleCount}/{totalCount}
            </span>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </header>
      {open && (
        <div className={cn("grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
          {children}
        </div>
      )}
    </section>
  );
}
