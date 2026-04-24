// Barra colapsável de maturidade do setor, mostrada no topo do módulo.

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Gauge, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useSectorOnboarding } from "@/hooks/useSectorOnboarding";
import {
  MATURITY_LABEL_META,
  SECTOR_META,
  SectorKey,
  ChecklistItem,
} from "@/lib/sectorMaturity/types";
import { SectorOnboardingChecklist } from "./SectorOnboardingChecklist";
import { cn } from "@/lib/utils";

interface Props {
  sector: SectorKey;
  onTabChange?: (tab: string) => void;
}

export function SectorOnboardingBar({ sector, onTabChange }: Props) {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { result, isLoading, refresh } = useSectorOnboarding(sector);

  if (isLoading || !result) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Gauge size={16} className="animate-pulse" />
            Calculando maturidade do setor…
          </div>
        </CardContent>
      </Card>
    );
  }

  const meta = MATURITY_LABEL_META[result.label];

  const handleAction = (item: ChecklistItem) => {
    if (item.ctaTab && onTabChange) {
      onTabChange(item.ctaTab);
      setDrawer(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Gauge size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Maturidade do {SECTOR_META[sector].label}
                </p>
                <p className="text-xs text-muted-foreground">
                  Termômetro do setor — {result.score}/100
                </p>
              </div>
              <Badge variant="outline" className={cn("ml-1", meta.badgeClass)}>
                {meta.label}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDrawer(true)}>
                <ListChecks size={14} className="mr-1" /> Checklist
              </Button>
              <Button size="sm" variant="ghost" onClick={refresh} title="Recalcular">
                <RefreshCw size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Recolher" : "Expandir"}
              >
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
            </div>
          </div>

          <Progress value={result.score} className="h-2" />

          {open && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <MiniGauge label="Completude" value={result.completeness} max={50} />
              <MiniGauge label="Atualização" value={result.freshness} max={25} />
              <MiniGauge label="Rotinas" value={result.routines} max={25} />
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Gauge size={18} className="text-primary" />
              Maturidade do {SECTOR_META[sector].label}
            </SheetTitle>
            <SheetDescription>
              {result.score}/100 — {meta.label}. Clique em um item para ir até a aba correspondente.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <SectorOnboardingChecklist result={result} onItemAction={handleAction} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MiniGauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.round(value * 10) / 10}/{max}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
