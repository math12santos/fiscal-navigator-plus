// Card compacto que exibe a maturidade de um setor no Dashboard Geral.
// Reusa o mesmo motor de avaliação (`useSectorOnboarding`) que alimenta a
// barra completa dentro de cada módulo, garantindo single source of truth.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSectorOnboarding } from "@/hooks/useSectorOnboarding";
import {
  MATURITY_LABEL_META,
  SECTOR_META,
  SectorKey,
  SectorMaturityResult,
} from "@/lib/sectorMaturity/types";
import { cn } from "@/lib/utils";

interface Props {
  sector: SectorKey;
  // Permite que o pai (MaturityOverviewSection) leia o resultado para o consolidado.
  onResult?: (sector: SectorKey, result: SectorMaturityResult | null) => void;
}

export function SectorMaturityCard({ sector, onResult }: Props) {
  const navigate = useNavigate();
  const { result, isLoading } = useSectorOnboarding(sector);

  // Reporta o resultado para o pai (sem useEffect para evitar loop: o hook
  // já memoiza o objeto entre renders quando os inputs não mudam).
  useMemo(() => {
    onResult?.(sector, result ?? null);
  }, [sector, result, onResult]);

  const meta = SECTOR_META[sector];

  if (isLoading || !result) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const labelMeta = MATURITY_LABEL_META[result.label];
  const pendingCount = result.checklist.filter((c) => !c.done).length;

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground truncate">
                {meta.label}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.score}/100 — {pendingCount === 0
                ? "Sem pendências"
                : `${pendingCount} pendência${pendingCount > 1 ? "s" : ""}`}
            </p>
          </div>
          <Badge variant="outline" className={cn("shrink-0", labelMeta.badgeClass)}>
            {labelMeta.label}
          </Badge>
        </div>

        <Progress value={result.score} className="h-2" />

        <div className="grid grid-cols-3 gap-2">
          <MiniDimension label="Completude" value={result.completeness} max={50} />
          <MiniDimension label="Atualização" value={result.freshness} max={25} />
          <MiniDimension label="Rotinas" value={result.routines} max={25} />
        </div>

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => navigate(meta.route)}
          >
            Abrir setor
            <ArrowRight size={12} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniDimension({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-medium text-muted-foreground truncate">{label}</span>
        <span className="text-[10px] tabular-nums text-foreground">
          {Math.round(value)}/{max}
        </span>
      </div>
      <Progress value={pct} className="h-1 mt-1" />
    </div>
  );
}
