// Lista detalhada do checklist de maturidade — usada na barra (drawer) e no Backoffice.

import { CheckCircle2, AlertCircle, Circle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ChecklistItem,
  MaturityCategory,
  SectorMaturityResult,
} from "@/lib/sectorMaturity/types";

const CATEGORY_META: Record<MaturityCategory, { label: string; max: number }> = {
  completude: { label: "Completude (estrutural)", max: 50 },
  atualizacao: { label: "Atualização (frescor)", max: 25 },
  rotinas: { label: "Cumprimento de rotinas", max: 25 },
};

interface Props {
  result: SectorMaturityResult;
  onItemAction?: (item: ChecklistItem) => void;
  readOnly?: boolean;
}

function ItemRow({ item, onItemAction, readOnly }: {
  item: ChecklistItem;
  onItemAction?: (item: ChecklistItem) => void;
  readOnly?: boolean;
}) {
  const ratio = item.weight > 0 ? item.earned / item.weight : 0;
  const Icon = ratio >= 1 ? CheckCircle2 : ratio > 0 ? AlertCircle : Circle;
  const iconClass =
    ratio >= 1
      ? "text-emerald-600"
      : ratio > 0
      ? "text-amber-600"
      : "text-muted-foreground";

  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={18} className={cn("mt-0.5 shrink-0", iconClass)} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
            {Math.round(item.earned * 10) / 10}/{item.weight} pts
          </span>
        </div>
        {(item.detail || item.hint) && (
          <p className="text-xs text-muted-foreground">
            {item.detail && <span className="font-medium text-foreground/80">{item.detail}</span>}
            {item.detail && item.hint && <span> — </span>}
            {item.hint}
          </p>
        )}
        <Progress value={ratio * 100} className="h-1.5 mt-1.5" />
      </div>
      {!readOnly && item.ctaTab && ratio < 1 && onItemAction && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 h-7"
          onClick={() => onItemAction(item)}
        >
          Ir <ArrowRight size={12} className="ml-1" />
        </Button>
      )}
    </div>
  );
}

export function SectorOnboardingChecklist({ result, onItemAction, readOnly }: Props) {
  const categories: MaturityCategory[] = ["completude", "atualizacao", "rotinas"];
  return (
    <div className="space-y-5">
      {categories.map((cat) => {
        const items = result.checklist.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const earned = items.reduce((s, i) => s + i.earned, 0);
        const max = CATEGORY_META[cat].max;
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {CATEGORY_META[cat].label}
              </h4>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(earned * 10) / 10}/{max} pts
              </span>
            </div>
            <Progress value={(earned / max) * 100} className="h-2" />
            <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-muted/30 px-3">
              {items.map((it) => (
                <ItemRow key={it.key} item={it} onItemAction={onItemAction} readOnly={readOnly} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
