import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator } from "lucide-react";
import { useEmployees, useTerminations } from "@/hooks/useDP";
import { format } from "date-fns";
import TerminationSimulatorDialog, { TERM_TYPES } from "./TerminationSimulatorDialog";

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
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Total Rescisão</TableHead>
                  <TableHead>Multa FGTS</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminations.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma rescisão registrada</TableCell></TableRow>
                ) : (
                  terminations.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-foreground">{empMap[t.employee_id]?.name || "—"}</TableCell>
                      <TableCell className="text-xs">{format(new Date(t.termination_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell><Badge variant="outline">{TERM_TYPES.find((tt) => tt.value === t.type)?.label || t.type}</Badge></TableCell>
                      <TableCell className="font-mono font-bold">{fmt(t.total_rescisao)}</TableCell>
                      <TableCell className="font-mono text-destructive">{fmt(t.multa_fgts)}</TableCell>
                      <TableCell><Badge variant={t.status === "simulacao" ? "secondary" : "default"}>{t.status}</Badge></TableCell>
                    </TableRow>
                  ))
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
