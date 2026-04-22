import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator } from "lucide-react";
import { useEmployees, useTerminations } from "@/hooks/useDP";
import { format } from "date-fns";
import TerminationSimulatorDialog, { TERM_TYPES, PJ_TERM_TYPES } from "./TerminationSimulatorDialog";

const ALL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  [...TERM_TYPES, ...PJ_TERM_TYPES].map((t) => [t.value, t.label]),
);

export default function DPRescisoes() {
  const { data: employees = [] } = useEmployees();
  const { data: terminations = [] } = useTerminations();

  const [simOpen, setSimOpen] = useState(false);

  const empMap = useMemo(() => {
    const m: Record<string, any> = {};
    employees.forEach((e: any) => { m[e.id] = e; });
    return m;
  }, [employees]);

  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={() => setSimOpen(true)}>
          <Calculator size={14} className="mr-1" /> Simular Desligamento
        </Button>
      </div>

      {/* Histórico */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Rescisões Registradas</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Regime</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Total Rescisão</TableHead>
                  <TableHead>Multa FGTS</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminations.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma rescisão registrada</TableCell></TableRow>
                ) : (
                  terminations.map((t: any) => {
                    const emp = empMap[t.employee_id];
                    // Prioriza snapshot histórico (t.contract_type) sobre regime atual do colaborador.
                    const regime = t.contract_type || emp?.contract_type || "—";
                    const regimeMudou = t.contract_type && emp?.contract_type && t.contract_type !== emp.contract_type;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-foreground">{emp?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{regime}</Badge>
                          {regimeMudou && (
                            <span
                              className="ml-1 text-[9px] text-muted-foreground"
                              title={`Regime atual do colaborador: ${emp.contract_type}`}
                            >
                              (histórico)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{format(new Date(t.termination_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell><Badge variant="outline">{ALL_TYPE_LABELS[t.type] || t.type}</Badge></TableCell>
                        <TableCell className="font-mono font-bold">{fmt(t.total_rescisao)}</TableCell>
                        <TableCell className="font-mono text-destructive">
                          {regime === "PJ" || regime === "estagio" ? <span className="text-muted-foreground">—</span> : fmt(t.multa_fgts)}
                        </TableCell>
                        <TableCell><Badge variant={t.status === "simulacao" ? "secondary" : "default"}>{t.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TerminationSimulatorDialog open={simOpen} onOpenChange={setSimOpen} />
    </div>
  );
}
