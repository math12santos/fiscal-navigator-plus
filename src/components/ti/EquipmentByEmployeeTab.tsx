import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Home } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { useEquipmentByEmployee } from "@/hooks/useITKits";
import { useEmployees } from "@/hooks/useDP";
import { format } from "date-fns";

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function EquipmentByEmployeeTab() {
  const { data = [], isLoading } = useEquipmentByEmployee();
  const { data: employees = [] } = useEmployees();
  const empMap = useMemo(() => Object.fromEntries((employees ?? []).map((e: any) => [e.id, e])), [employees]);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (data ?? [])
      .map((r: any) => ({ ...r, employee_name: empMap[r.employee_id]?.name ?? "—" }))
      .filter((r: any) => !t || r.employee_name.toLowerCase().includes(t))
      .sort((a: any, b: any) => b.total_acquisition_value - a.total_acquisition_value);
  }, [data, empMap, q]);

  return (
    <SectionCard
      icon={Users}
      title="Equipamentos por colaborador"
      description="Visão consolidada de equipamentos atribuídos, valor total e próxima revisão de substituição."
      actions={
        <div className="relative w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      }
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3">Colaborador</th>
              <th className="p-3">Equipamentos</th>
              <th className="p-3 text-right">Qtd</th>
              <th className="p-3 text-right">Valor total</th>
              <th className="p-3">Próxima revisão</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum equipamento atribuído.</td></tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.employee_id} className="border-t hover:bg-muted/30 align-top">
                <td className="p-3 font-medium">
                  {r.employee_name}
                  {r.home_office_count > 0 && (
                    <Badge variant="outline" className="ml-2 gap-1"><Home className="h-3 w-3" />HO {r.home_office_count}</Badge>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(r.equipments ?? []).map((eq: any) => (
                      <Badge key={eq.id} variant="secondary" className="text-xs">
                        {eq.type.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums">{r.total_equipments}</td>
                <td className="p-3 text-right tabular-nums">{fmt(r.total_acquisition_value)}</td>
                <td className="p-3">{r.next_review_date ? format(new Date(r.next_review_date), "dd/MM/yyyy") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
