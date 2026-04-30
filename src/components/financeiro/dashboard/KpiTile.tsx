import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, ArrowRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { KpiDefinition } from "./kpiRegistry";
import { KpiResult } from "@/hooks/useFinancialDashboardKPIs";

interface KpiTileProps {
  def: KpiDefinition;
  result: KpiResult;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

function formatValue(value: number, format: KpiDefinition["format"]): string {
  if (!isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });
    case "percent":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${Math.round(value)} dias`;
    case "ratio":
      return `${value.toFixed(2)}x`;
    case "number":
    default:
      return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  }
}

/** Formata negativos no padrão contábil: (R$ 1.234,00) em vermelho. */
function formatAccounting(value: number, format: KpiDefinition["format"]): { text: string; negative: boolean } {
  const negative = value < 0;
  const abs = Math.abs(value);
  let text = formatValue(abs, format);
  if (negative) text = `(${text})`;
  return { text, negative };
}

export function KpiTile({ def, result, enabled, onToggle }: KpiTileProps) {
  const navigate = useNavigate();

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 flex items-center justify-between gap-2 min-h-[112px]">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {def.label}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">Oculto</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(true)}
          className="text-xs"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Reativar
        </Button>
      </div>
    );
  }

  const isMissing = result.status === "missing";
  const isLoading = result.status === "loading";

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-2 min-h-[112px] transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {def.label}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-label="Sobre este KPI" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs font-medium">{def.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Fórmula: {def.formula}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1">
              <span className="sr-only">Opções</span>
              <span className="text-muted-foreground">⋮</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onToggle(false)}>
              <EyeOff className="h-3.5 w-3.5 mr-2" />
              Ocultar este KPI
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <div className="h-8 w-24 bg-muted/50 animate-pulse rounded" />
      ) : isMissing ? (
        <div className="flex-1 flex flex-col gap-1.5 justify-between">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-snug">
              Falta: {result.missingReasons[0]}
              {result.missingReasons.length > 1 && ` (+${result.missingReasons.length - 1})`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs justify-between"
            onClick={() => navigate(def.cta.route)}
          >
            <span className="truncate">{def.cta.label}</span>
            <ArrowRight className="h-3 w-3 ml-1 shrink-0" />
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-end gap-0.5">
          {(() => {
            const v = result.value as number;
            const { text, negative } = formatAccounting(v, def.format);
            return (
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums leading-tight",
                  negative ? "text-destructive" : "text-foreground",
                )}
              >
                {text}
              </p>
            );
          })()}
          {result.hint && (
            <p className="text-[11px] text-muted-foreground truncate" title={result.hint}>
              {result.hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
