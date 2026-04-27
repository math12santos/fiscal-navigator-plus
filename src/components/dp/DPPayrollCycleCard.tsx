import { useNavigate } from "react-router-dom";
import { Wallet, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDPPayrollExecution } from "@/hooks/useDPPayrollExecution";
import { DpSection } from "./DpSection";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Mostra a execução da folha do mês corrente: previsto vs. pago vs. a pagar.
 * Liga o módulo DP ao Financeiro permitindo drill-down imediato.
 */
export default function DPPayrollCycleCard() {
  const navigate = useNavigate();
  const exec = useDPPayrollExecution();
  const monthLabel = format(exec.monthStart, "MMMM/yyyy", { locale: ptBR });

  const goToFinanceiro = () => {
    navigate(
      `/financeiro?categoria=Pessoal&from=${format(exec.monthStart, "yyyy-MM-dd")}&to=${format(exec.monthEnd, "yyyy-MM-dd")}`,
    );
  };

  return (
    <DpSection
      icon={Wallet}
      title="Ciclo da Folha do Mês"
      description={`Execução financeira da folha de ${monthLabel} — previsto, pago e a pagar`}
      actions={
        <Button size="sm" variant="outline" onClick={goToFinanceiro} className="h-8 text-xs">
          Ver no Financeiro <ArrowRight size={12} className="ml-1" />
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Previsto" value={fmt(exec.previsto)} tone="muted" />
        <Stat label="Pago" value={fmt(exec.pago)} tone="success" />
        <Stat label="A pagar" value={fmt(exec.aPagar)} tone="warning" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Execução</span>
          <span className="font-mono tabular-nums text-foreground">
            {exec.pct.toFixed(1)}%
          </span>
        </div>
        <Progress value={exec.pct} className="h-2" />
        <p className="text-[11px] text-muted-foreground">
          {exec.materializedCount} lançamento(s) materializado(s) · {exec.projectionsCount} projeção(ões) abertas
        </p>
      </div>
    </DpSection>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "muted" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success border-success/30 bg-success/5"
      : tone === "warning"
        ? "text-warning border-warning/30 bg-warning/5"
        : "text-foreground border-border bg-muted/20";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
