import { useHolding } from "@/contexts/HoldingContext";
import { Building2, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Toggle for holding mode, shown only when current org is a holding.
 * Includes a sub-toggle for consolidated vs per-company view.
 */
export function HoldingToggle() {
  const {
    isHolding,
    holdingMode,
    setHoldingMode,
    holdingView,
    setHoldingView,
    subsidiaryIds,
    setSelectedSubsidiaryId,
  } = useHolding();

  if (!isHolding) return null;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={holdingMode ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-1.5 h-8 text-xs font-medium transition-all",
              holdingMode && "shadow-md"
            )}
            onClick={() => setHoldingMode(!holdingMode)}
          >
            <Building2 size={14} />
            Holding
            <Badge
              variant="secondary"
              className={cn(
                "ml-0.5 h-4 px-1.5 text-[10px] font-bold",
                holdingMode
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {subsidiaryIds.length}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {holdingMode
            ? "Desativar visão Holding"
            : `Ativar visão Holding (${subsidiaryIds.length} subsidiária${subsidiaryIds.length !== 1 ? "s" : ""})`}
        </TooltipContent>
      </Tooltip>

      {holdingMode && (
        <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          <button
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-all",
              holdingView === "consolidated"
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setHoldingView("consolidated"); setSelectedSubsidiaryId(null); }}
          >
            Consolidado
          </button>
          <button
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-all flex items-center gap-1",
              holdingView === "per-company"
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setHoldingView("per-company"); setSelectedSubsidiaryId(null); }}
          >
            <LayoutGrid size={12} />
            Por Empresa
          </button>
        </div>
      )}
    </div>
  );
}
