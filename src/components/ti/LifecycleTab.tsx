import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { useITLifecycleAlerts } from "@/hooks/useITKits";
import { useEmployees } from "@/hooks/useDP";
import { format } from "date-fns";

const TONE: Record<string, string> = {
  expired: "bg-destructive/15 text-destructive",
  critical: "bg-destructive/10 text-destructive",
  warning: "bg-warning/15 text-warning",
  ok: "bg-success/10 text-success",
  unknown: "bg-muted text-muted-foreground",
};

const LABEL: Record<string, string> = {
  expired: "Vencido",
  critical: "Crítico (≤6m)",
  warning: "Atenção (≤12m)",
  ok: "OK",
  unknown: "Sem data",
};

export function LifecycleTab() {
  const { data = [], isLoading } = useITLifecycleAlerts();
  const { data: employees = [] } = useEmployees();
  const empMap = useMemo(() => Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name])), [employees]);

  const alerts = (data ?? []).filter((a: any) => a.alert_level !== "ok").sort((a: any, b: any) => {
    const order: any = { expired: 0, critical: 1, warning: 2, unknown: 3 };
    return order[a.alert_level] - order[b.alert_level];
  });

  return (
    <SectionCard
      icon={AlertTriangle}
      title="Ciclo de vida & substituição"
      description="Equipamentos próximos do fim da vida útil ou com revisão de substituição vencida."
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3">Equipamento</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">Aquisição</th>
              <th className="p-3">Fim vida útil</th>
              <th className="p-3 text-right">Meses restantes</th>
              <th className="p-3">Próx. revisão</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && alerts.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum alerta. Tudo dentro do prazo.</td></tr>
            )}
            {alerts.map((a: any) => (
              <tr key={a.equipment_id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <div className="font-mono text-xs">{a.patrimonial_code}</div>
                  <div className="font-medium">{a.name}</div>
                </td>
                <td className="p-3">{a.responsible_employee_id ? empMap[a.responsible_employee_id] ?? "—" : "—"}</td>
                <td className="p-3">{a.acquisition_date ? format(new Date(a.acquisition_date), "dd/MM/yyyy") : "—"}</td>
                <td className="p-3">{a.end_of_life_date ? format(new Date(a.end_of_life_date), "dd/MM/yyyy") : "—"}</td>
                <td className="p-3 text-right tabular-nums">{a.months_remaining}</td>
                <td className="p-3">
                  {a.next_replacement_review_date ? (
                    <span className={a.review_overdue ? "text-destructive inline-flex items-center gap-1" : ""}>
                      {a.review_overdue && <Clock className="h-3 w-3" />}
                      {format(new Date(a.next_replacement_review_date), "dd/MM/yyyy")}
                    </span>
                  ) : "—"}
                </td>
                <td className="p-3"><Badge className={TONE[a.alert_level]}>{LABEL[a.alert_level]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
