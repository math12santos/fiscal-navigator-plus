import { useState } from "react";
import { useFinanceiroAvgTerms } from "@/hooks/useFinanceiroAvgTerms";
import { AvgTermsDetailDialog } from "./AvgTermsDetailDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PMPMRKpiCardProps {
  tipo: "saida" | "entrada";
  windowDays?: number;
}

/** KPI compacto que exibe PMP ou PMR. Clicável para drill-down. */
export function PMPMRKpiCard({ tipo, windowDays = 90 }: PMPMRKpiCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const result = useFinanceiroAvgTerms(tipo, windowDays);
  const indicador = tipo === "saida" ? "PMP" : "PMR";
  const label = tipo === "saida" ? "Prazo Médio Pagamento" : "Prazo Médio Recebimento";

  const lowCoverage = result.cobertura_pct < 80;
  const noData = result.count === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        className={cn(
          "rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 hover:border-primary/40",
          "flex flex-col gap-1 min-h-[112px] w-full"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {indicador}
          </span>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>

        {noData ? (
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-sm text-muted-foreground">Sem dados nos últimos {windowDays} dias</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-foreground">{result.pmp_pmr_days}</span>
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[10px]",
                    lowCoverage ? "text-amber-600" : "text-muted-foreground"
                  )}>
                    {lowCoverage ? <AlertCircle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                    {result.cobertura_pct}% cob.
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">
                    {result.count} lançamento{result.count > 1 ? "s" : ""} com competência preenchida.{" "}
                    {result.count_sem_competencia > 0 && (
                      <span className="text-amber-300">
                        {result.count_sem_competencia} sem competência (não entram no cálculo).
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Clique para ver detalhes.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </button>

      <AvgTermsDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        tipo={tipo}
        result={result}
      />
    </>
  );
}
