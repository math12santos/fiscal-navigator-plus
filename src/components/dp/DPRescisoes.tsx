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
        <Button onClick={() => { setSimOpen(true); setSimResult(null); }}>
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

      {/* Simulator Dialog */}
      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Simulador de Desligamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeEmps.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} — {fmt(Number(e.salary_base))}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={termType} onValueChange={setTermType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={termDate} onChange={(e) => setTermDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSimulate} disabled={!selectedEmpId} className="w-full">
              <Calculator size={14} className="mr-1" /> Calcular
            </Button>

            {simResult && (
              <div className="border border-border rounded-lg p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between text-sm"><span>Saldo de Salário</span><span className="font-mono">{fmt(simResult.saldo_salario)}</span></div>
                <div className="flex justify-between text-sm"><span>Aviso Prévio</span><span className="font-mono">{fmt(simResult.aviso_previo)}</span></div>
                <div className="flex justify-between text-sm"><span>Férias Proporcionais</span><span className="font-mono">{fmt(simResult.ferias_proporcionais)}</span></div>
                <div className="flex justify-between text-sm"><span>1/3 Férias</span><span className="font-mono">{fmt(simResult.terco_ferias)}</span></div>
                <div className="flex justify-between text-sm"><span>13º Proporcional</span><span className="font-mono">{fmt(simResult.decimo_terceiro_proporcional)}</span></div>
                <div className="flex justify-between text-sm text-destructive"><span>Multa FGTS</span><span className="font-mono">{fmt(simResult.multa_fgts)}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Total Rescisão</span>
                  <span className="font-mono text-lg">{fmt(simResult.total_rescisao)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <AlertTriangle size={12} />
                  <span>Impacto imediato no caixa: {fmt(simResult.total_rescisao)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimOpen(false)}>Cancelar</Button>
            {simResult && (
              <Button onClick={handleSaveTermination} disabled={create.isPending}>
                Registrar Rescisão
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
