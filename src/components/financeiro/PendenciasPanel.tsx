import { useMemo } from "react";
import { format, startOfMonth } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Users, FileText, Info } from "lucide-react";
import { useEmployees } from "@/hooks/useDP";
import { useContracts } from "@/hooks/useContracts";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";

interface Props {
  entries: FinanceiroEntry[];
  onClassify?: (projectedEntries: FinanceiroEntry[]) => void;
}

export function PendenciasPanel({ entries, onClassify }: Props) {
  const { data: employees } = useEmployees();
  const { contracts } = useContracts();

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM");

  const pendencies = useMemo(() => {
    const items: { type: string; label: string; detail: string; projectedEntries: FinanceiroEntry[] }[] = [];

    // 1. Active employees — check if there are projected DP entries not yet materialized
    const activeEmps = (employees ?? []).filter((e: any) => e.status === "ativo");
    const hasMaterializedDP = entries.some(
      (e) => e.source === "dp" && !e.id.startsWith("proj-") &&
        format(new Date(e.data_prevista), "yyyy-MM") === monthStart
    );

    if (activeEmps.length > 0 && !hasMaterializedDP) {
      const dpProjections = entries.filter(
        (e) => e.source === "dp" && e.id.startsWith("proj-") &&
          format(new Date(e.data_prevista), "yyyy-MM") === monthStart
      );
      if (dpProjections.length > 0) {
        items.push({
          type: "dp",
          label: `${activeEmps.length} colaborador(es) ativo(s)`,
          detail: `Folha de ${format(now, "MM/yyyy")} — ${dpProjections.length} projeções aguardando classificação`,
          projectedEntries: dpProjections,
        });
      }
    }

    // 2. Active outgoing contracts without materialized entry this month
    const activeContracts = contracts.filter(
      (c) => c.status === "Ativo" && c.impacto_resultado !== "receita"
    );
    const materializedContractIds = new Set(
      entries
        .filter((e) => e.source === "contrato" && e.contract_id && !e.id.startsWith("proj-"))
        .filter((e) => format(new Date(e.data_prevista), "yyyy-MM") === monthStart)
        .map((e) => e.contract_id)
    );

    for (const c of activeContracts) {
      if (!materializedContractIds.has(c.id)) {
        const contractProjections = entries.filter(
          (e) => e.contract_id === c.id && e.id.startsWith("proj-") &&
            format(new Date(e.data_prevista), "yyyy-MM") === monthStart
        );
        if (contractProjections.length > 0) {
          items.push({
            type: "contrato",
            label: c.nome,
            detail: `Contrato ativo sem lançamento em ${format(now, "MM/yyyy")}`,
            projectedEntries: contractProjections,
          });
        }
      }
    }

    return items;
  }, [employees, contracts, entries, monthStart]);

  if (pendencies.length === 0) return null;

  return (
    <Alert className="border-warning/50 bg-warning/5">
      <Info className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">Pendências de classificação ({pendencies.length})</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-2">
          {pendencies.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                {p.type === "dp" ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                <span>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground ml-1">— {p.detail}</span>
                </span>
              </div>
              {onClassify && p.projectedEntries.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => onClassify(p.projectedEntries)}>
                  Classificar ({p.projectedEntries.length})
                </Button>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
