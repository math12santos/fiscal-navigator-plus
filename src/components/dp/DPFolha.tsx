import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calculator, Lock } from "lucide-react";
import { useEmployees, usePayrollRuns, usePayrollItems, useMutatePayroll, useDPConfig, calcINSSEmpregado, calcIRRF, calcEncargosPatronais } from "@/hooks/useDP";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DPFolha() {
  const { data: employees = [] } = useEmployees();
  const { data: runs = [], isLoading } = usePayrollRuns();
  const { data: dpConfig } = useDPConfig();
  const { createRun, updateRun } = useMutatePayroll();
  const { toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  const activeEmployees = employees.filter((e: any) => e.status === "ativo");
  const selectedRun = runs.find((r: any) => r.id === selectedRunId);
  const { data: items = [] } = usePayrollItems(selectedRunId || undefined);

  const handleCreateRun = () => {
    const refMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");
    createRun.mutate({ reference_month: refMonth }, {
      onSuccess: (data: any) => {
        setSelectedRunId(data.id);
        toast({ title: "Folha criada" });
      },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const handleCalcPayroll = async () => {
    if (!selectedRunId) return;
    const { upsertItem } = useMutatePayrollInner();
    let totalBruto = 0, totalDescontos = 0, totalLiquido = 0, totalEncargos = 0;

    for (const emp of activeEmployees) {
      const salario = Number(emp.salary_base || 0);
      const inssEmp = calcINSSEmpregado(salario);
      const baseIRRF = salario - inssEmp;
      const irrf = calcIRRF(baseIRRF);
      const vtDesconto = salario * ((dpConfig?.vt_desconto_pct ?? 6) / 100);
      const enc = calcEncargosPatronais(salario, dpConfig);

      const bruto = salario;
      const descontos = inssEmp + irrf + vtDesconto;
      const liquido = bruto - descontos;

      totalBruto += bruto;
      totalDescontos += descontos;
      totalLiquido += liquido;
      totalEncargos += enc.total;

      await upsertItem({
        payroll_run_id: selectedRunId,
        employee_id: emp.id,
        salario_base: salario,
        inss_empregado: Math.round(inssEmp * 100) / 100,
        irrf: Math.round(irrf * 100) / 100,
        vt_desconto: Math.round(vtDesconto * 100) / 100,
        inss_patronal: Math.round(enc.inssPatronal * 100) / 100,
        fgts: Math.round(enc.fgts * 100) / 100,
        total_bruto: bruto,
        total_descontos: Math.round(descontos * 100) / 100,
        total_liquido: Math.round(liquido * 100) / 100,
        total_encargos: Math.round(enc.total * 100) / 100,
      });
    }

    updateRun.mutate({
      id: selectedRunId,
      total_bruto: totalBruto,
      total_descontos: Math.round(totalDescontos * 100) / 100,
      total_liquido: Math.round(totalLiquido * 100) / 100,
      total_encargos: Math.round(totalEncargos * 100) / 100,
      status: "calculada",
    });
    toast({ title: "Folha calculada com sucesso" });
  };

  // Inline hook usage for sequential upserts
  function useMutatePayrollInner() {
    const { upsertItem: upsertMut } = useMutatePayroll();
    return {
      upsertItem: async (item: any) => {
        return new Promise<void>((resolve, reject) => {
          upsertMut.mutate(item, { onSuccess: () => resolve(), onError: reject });
        });
      },
    };
  }

  const handleLock = () => {
    if (!selectedRunId) return;
    updateRun.mutate({ id: selectedRunId, locked: true, status: "fechada" });
    toast({ title: "Folha fechada/travada" });
  };

  const empMap = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach((e: any) => { m[e.id] = e.name; });
    return m;
  }, [employees]);

  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedRunId} onValueChange={setSelectedRunId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecione uma folha" /></SelectTrigger>
          <SelectContent>
            {runs.map((r: any) => (
              <SelectItem key={r.id} value={r.id}>
                {format(new Date(r.reference_month), "MMMM/yyyy", { locale: ptBR })} — {r.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCreateRun} variant="outline"><Plus size={14} className="mr-1" /> Nova Folha</Button>
        {selectedRun && !selectedRun.locked && (
          <>
            <Button onClick={handleCalcPayroll}><Calculator size={14} className="mr-1" /> Calcular</Button>
            <Button onClick={handleLock} variant="destructive"><Lock size={14} className="mr-1" /> Fechar Folha</Button>
          </>
        )}
      </div>

      {selectedRun && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Bruto</p><p className="font-bold text-foreground">{fmt(selectedRun.total_bruto)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Descontos</p><p className="font-bold text-destructive">{fmt(selectedRun.total_descontos)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Líquido</p><p className="font-bold text-foreground">{fmt(selectedRun.total_liquido)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Encargos</p><p className="font-bold text-muted-foreground">{fmt(selectedRun.total_encargos)}</p></CardContent></Card>
        </div>
      )}

      {selectedRunId && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Salário</TableHead>
                <TableHead>INSS</TableHead>
                <TableHead>IRRF</TableHead>
                <TableHead>VT</TableHead>
                <TableHead>Líquido</TableHead>
                <TableHead>FGTS</TableHead>
                <TableHead>Encargos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Clique em "Calcular" para gerar a folha</TableCell></TableRow>
              ) : (
                items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-foreground">{empMap[item.employee_id] || "—"}</TableCell>
                    <TableCell className="font-mono">{fmt(item.salario_base)}</TableCell>
                    <TableCell className="text-destructive font-mono">{fmt(item.inss_empregado)}</TableCell>
                    <TableCell className="text-destructive font-mono">{fmt(item.irrf)}</TableCell>
                    <TableCell className="text-destructive font-mono">{fmt(item.vt_desconto)}</TableCell>
                    <TableCell className="font-mono font-bold">{fmt(item.total_liquido)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{fmt(item.fgts)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{fmt(item.total_encargos)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!selectedRunId && (
        <div className="text-center py-12 text-muted-foreground">
          Selecione ou crie uma folha de pagamento para começar.
        </div>
      )}
    </div>
  );
}
