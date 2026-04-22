import { useState, useMemo } from "react";
import { useLiabilities } from "@/hooks/useLiabilities";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, ChevronDown, Receipt, Scale, Shield, TrendingDown, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PlanningScenarios from "@/components/planning/PlanningScenarios";
import PlanningLiabilities from "@/components/planning/PlanningLiabilities";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const tipoLabels: Record<string, string> = {
  divida: "Dívida",
  contingencia: "Contingência",
  provisao: "Provisão",
};

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function PlanningScenariosRisk({ startDate, endDate }: Props) {
  const { liabilities, totals: liabTotals } = useLiabilities();
  const { totals: apTotals, isLoading: apLoading } = useFinanceiro("saida");
  const [openLiabilities, setOpenLiabilities] = useState(false);

  // Active liabilities feeding stress scenario
  const stressContributors = useMemo(
    () => liabilities.filter((l) => l.status === "ativo" || l.status === "judicial"),
    [liabilities]
  );

  const stressExtraOutflow = useMemo(() => {
    return stressContributors.reduce((sum, l) => {
      const base = Number(l.valor_atualizado);
      const factor = (Number(l.impacto_stress) || 0) / 100;
      return sum + base * factor;
    }, 0);
  }, [stressContributors]);

  return (
    <div className="space-y-6">
      {/* Risk KPIs (passivos as risk vector) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard title="Total Passivos" value={fmt(liabTotals.total)} icon={<TrendingDown size={18} />} />
        <KPICard title="Dívidas" value={fmt(liabTotals.dividas)} icon={<AlertTriangle size={18} />} />
        <KPICard title="Cont. Prováveis" value={fmt(liabTotals.contingencias_provaveis)} icon={<Scale size={18} />} />
        <KPICard title="Exposição Stress" value={fmt(liabTotals.stress_total)} icon={<Shield size={18} />} />
        <KPICard
          title="Contas a Pagar"
          value={apLoading ? "..." : fmt(apTotals.pendente)}
          icon={<Receipt size={18} />}
        />
      </div>

      {/* Stress contribution banner */}
      {stressContributors.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/5 border border-warning/20">
          <Zap className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-medium text-foreground">
              {stressContributors.length} passivo(s) alimentando o cenário Stress
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Saída adicional projetada sob stress: <span className="font-semibold text-warning">{fmt(stressExtraOutflow)}</span>
              {" "}— soma do <span className="italic">impacto_stress</span> de cada passivo ativo/judicial.
            </p>
          </div>
        </div>
      )}

      {/* Scenarios block */}
      <PlanningScenarios startDate={startDate} endDate={endDate} />

      {/* Collapsible liabilities table */}
      <Collapsible open={openLiabilities} onOpenChange={setOpenLiabilities}>
        <div className="glass-card">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Detalhamento de Passivos</h3>
                <Badge variant="outline" className="text-xs">{liabilities.length}</Badge>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${openLiabilities ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border p-4">
              <PlanningLiabilities />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
