import { useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Users, FileText, Info } from "lucide-react";
import { useEmployees } from "@/hooks/useDP";
import { useContracts } from "@/hooks/useContracts";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";

interface Props {
  entries: FinanceiroEntry[];
  onClassify?: (prefill: Partial<any>) => void;
}

export function PendenciasPanel({ entries, onClassify }: Props) {
  const { data: employees } = useEmployees();
  const { contracts } = useContracts();

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM");

  const pendencies = useMemo(() => {
    const items: { type: string; label: string; detail: string; prefill: any }[] = [];

    // 1. Active employees without materialized DP entry this month
    const activeEmps = (employees ?? []).filter((e: any) => e.status === "ativo");
    const materializedDPMonths = new Set(
      entries
        .filter((e) => e.source === "dp" && !e.id.startsWith("proj-"))
        .map((e) => format(new Date(e.data_prevista), "yyyy-MM"))
    );

    if (activeEmps.length > 0 && !materializedDPMonths.has(monthStart)) {
      items.push({
        type: "dp",
        label: `${activeEmps.length} colaborador(es) ativo(s)`,
        detail: `Folha de ${format(now, "MM/yyyy")} ainda não classificada no financeiro`,
        prefill: {
          descricao: `Folha de Pagamento — ${format(now, "MM/yyyy")}`,
          categoria: "Pessoal",
          source: "dp",
          tipo: "saida",
        },
      });
    }

    // 2. Active outgoing contracts without any financial entry this month
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
        // Check if there's at least a projected entry for it
        const hasProjection = entries.some(
          (e) => e.contract_id === c.id && e.id.startsWith("proj-") &&
            format(new Date(e.data_prevista), "yyyy-MM") === monthStart
        );
        if (!hasProjection) {
          items.push({
            type: "contrato",
            label: c.nome,
            detail: `Contrato ativo sem lançamento em ${format(now, "MM/yyyy")}`,
            prefill: {
              descricao: c.nome,
              contract_id: c.id,
              entity_id: c.entity_id,
              cost_center_id: c.cost_center_id,
              valor_previsto: c.valor,
              valor_bruto: c.valor,
              categoria: c.natureza_financeira,
              source: "contrato",
              tipo: "saida",
            },
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
              {onClassify && (
                <Button size="sm" variant="outline" onClick={() => onClassify(p.prefill)}>
                  Classificar
                </Button>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
