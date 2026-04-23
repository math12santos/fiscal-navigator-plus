import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calculator, Lock, FileText, Download, Sparkles } from "lucide-react";
import { useEmployees, usePayrollRuns, usePayrollItems, useMutatePayroll, useDPConfig, calcINSSEmpregado, calcIRRF, calcEncargosPatronais, usePositions } from "@/hooks/useDP";
import { useCostCenters } from "@/hooks/useCostCenters";

import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { generateDPExcelReport, generateDPPdfReport, generatePaystubPdf, dpFmt } from "@/lib/dpExports";
import { usePayrollEvents, summarizeEvents, type PayrollEvent } from "@/hooks/usePayrollEvents";
import PayrollEventsDialog from "./PayrollEventsDialog";
import PayrollDaysAdjustmentDialog from "./PayrollDaysAdjustmentDialog";
import PayrollBankHoursSimulator from "./PayrollBankHoursSimulator";
import DPPayrollComparison from "./DPPayrollComparison";
import { CalendarClock, Clock } from "lucide-react";
import {
  useBusinessDayOverrides,
  usePayrollDayOverrides,
  resolveBusinessDays,
} from "@/hooks/useBusinessDays";

export default function DPFolha() {
  const { data: employees = [] } = useEmployees();
  const { data: runs = [], isLoading } = usePayrollRuns();
  const { data: dpConfig } = useDPConfig();
  const { createRun, updateRun } = useMutatePayroll();
  const { toast } = useToast();
  const { currentOrg } = useOrganization();
  const { data: positions = [] } = usePositions();
  const { costCenters = [] } = useCostCenters();
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [eventsOpen, setEventsOpen] = useState(false);
  const [daysAdjOpen, setDaysAdjOpen] = useState(false);

  const activeEmployees = employees.filter((e: any) => e.status === "ativo");
  const selectedRun = runs.find((r: any) => r.id === selectedRunId);
  const { data: items = [] } = usePayrollItems(selectedRunId || undefined);
  const { data: events = [] } = usePayrollEvents({ runId: selectedRunId || undefined });
  const { data: monthlyOverrides = [] } = useBusinessDayOverrides();
  const { data: empDayOverrides = [] } = usePayrollDayOverrides(selectedRunId || undefined);

  // Eventos agregados por colaborador para esta folha
  const eventsByEmp = useMemo(() => {
    const m: Record<string, { proventos: number; descontos: number; liquido: number; count: number }> = {};
    events.forEach((ev: PayrollEvent) => {
      if (!m[ev.employee_id]) m[ev.employee_id] = { proventos: 0, descontos: 0, liquido: 0, count: 0 };
      const v = Number(ev.value || 0);
      if (ev.signal === "provento") m[ev.employee_id].proventos += v;
      else m[ev.employee_id].descontos += v;
      m[ev.employee_id].liquido = m[ev.employee_id].proventos - m[ev.employee_id].descontos;
      m[ev.employee_id].count += 1;
    });
    return m;
  }, [events]);

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
    if (!selectedRunId || !selectedRun) return;
    const { upsertItem } = useMutatePayrollInner();
    let totalBruto = 0, totalDescontos = 0, totalLiquido = 0, totalEncargos = 0;
    const refMonth = selectedRun.reference_month;

    for (const emp of activeEmployees) {
      const salario = Number(emp.salary_base || 0);
      const inssEmp = calcINSSEmpregado(salario);
      const baseIRRF = salario - inssEmp;
      const irrf = calcIRRF(baseIRRF);
      const empOverride = empDayOverrides.find((o) => o.employee_id === emp.id) ?? null;
      const resolved = resolveBusinessDays(refMonth, monthlyOverrides, empOverride);
      const businessDays = resolved.days;
      const vtBruto = Number(emp.vt_diario || 0) * businessDays;
      const vtDesconto = emp.vt_ativo ? Math.min(salario * ((dpConfig?.vt_desconto_pct ?? 6) / 100), vtBruto) : 0;
      const enc = calcEncargosPatronais(salario, dpConfig, emp.contract_type);

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
    const m: Record<string, any> = {};
    employees.forEach((e: any) => { m[e.id] = e; });
    return m;
  }, [employees]);

  const positionMap = useMemo(() => {
    const m: Record<string, string> = {};
    positions.forEach((p: any) => { m[p.id] = p.title; });
    return m;
  }, [positions]);

  const ccMap = useMemo(() => {
    const m: Record<string, string> = {};
    costCenters.forEach((c: any) => { m[c.id] = `${c.code} — ${c.name}`; });
    return m;
  }, [costCenters]);

  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const periodLabel = selectedRun
    ? format(new Date(selectedRun.reference_month), "MMMM/yyyy", { locale: ptBR })
    : "";

  const handleExportPdf = () => {
    if (!selectedRun || items.length === 0) {
      toast({ title: "Nada para exportar", description: "Selecione uma folha calculada." });
      return;
    }
    generateDPPdfReport({
      title: "Folha de Pagamento",
      orgName: currentOrg?.name,
      period: `Referência: ${periodLabel}`,
      summary: [
        { label: "Bruto", value: dpFmt.brl(selectedRun.total_bruto) },
        { label: "Descontos", value: dpFmt.brl(selectedRun.total_descontos) },
        { label: "Líquido", value: dpFmt.brl(selectedRun.total_liquido) },
        { label: "Encargos", value: dpFmt.brl(selectedRun.total_encargos) },
      ],
      columns: ["Colaborador", "Salário", "INSS", "IRRF", "VT Desc.", "Líquido", "FGTS", "Encargos"],
      rows: items.map((it: any) => [
        empMap[it.employee_id]?.name || "—",
        dpFmt.brl(it.salario_base),
        dpFmt.brl(it.inss_empregado),
        dpFmt.brl(it.irrf),
        dpFmt.brl(it.vt_desconto),
        dpFmt.brl(it.total_liquido),
        dpFmt.brl(it.fgts),
        dpFmt.brl(it.total_encargos),
      ]),
    });
  };

  const handleExportExcel = () => {
    if (!selectedRun || items.length === 0) {
      toast({ title: "Nada para exportar", description: "Selecione uma folha calculada." });
      return;
    }
    generateDPExcelReport({
      title: `Folha_${periodLabel}`,
      sheets: [
        {
          name: "Resumo",
          rows: [
            ["Empresa", currentOrg?.name || ""],
            ["Período", periodLabel],
            ["Status", selectedRun.status],
            [],
            ["Total Bruto", selectedRun.total_bruto],
            ["Total Descontos", selectedRun.total_descontos],
            ["Total Líquido", selectedRun.total_liquido],
            ["Total Encargos", selectedRun.total_encargos],
            ["Custo Total (Líquido + Encargos)", Number(selectedRun.total_liquido || 0) + Number(selectedRun.total_encargos || 0)],
          ],
        },
        {
          name: "Analítico",
          rows: [
            ["Colaborador", "Cargo", "CC", "Salário Base", "INSS", "IRRF", "VT Desconto", "Total Bruto", "Total Descontos", "Total Líquido", "FGTS", "INSS Patronal", "Total Encargos"],
            ...items.map((it: any) => {
              const e = empMap[it.employee_id] || {};
              return [
                e.name || "—",
                positionMap[e.position_id] || "—",
                ccMap[e.cost_center_id] || "—",
                Number(it.salario_base || 0),
                Number(it.inss_empregado || 0),
                Number(it.irrf || 0),
                Number(it.vt_desconto || 0),
                Number(it.total_bruto || 0),
                Number(it.total_descontos || 0),
                Number(it.total_liquido || 0),
                Number(it.fgts || 0),
                Number(it.inss_patronal || 0),
                Number(it.total_encargos || 0),
              ];
            }),
          ],
        },
      ],
    });
  };

  const handlePaystub = (item: any) => {
    const emp = empMap[item.employee_id] || {};
    const baseInss = Number(item.salario_base || 0);
    const baseIrrf = baseInss - Number(item.inss_empregado || 0);
    generatePaystubPdf({
      orgName: currentOrg?.name || "—",
      employeeName: emp.name || "—",
      employeeCpf: emp.cpf || undefined,
      position: positionMap[emp.position_id],
      costCenter: ccMap[emp.cost_center_id],
      admissionDate: emp.admission_date ? format(new Date(emp.admission_date), "dd/MM/yyyy") : undefined,
      referenceMonth: periodLabel,
      earnings: [
        { label: "Salário Base", ref: "30 dias", value: Number(item.salario_base || 0), type: "provento" },
        ...(Number(item.inss_empregado || 0) > 0
          ? [{ label: "INSS", ref: "—", value: Number(item.inss_empregado), type: "desconto" as const }]
          : []),
        ...(Number(item.irrf || 0) > 0
          ? [{ label: "IRRF", ref: "—", value: Number(item.irrf), type: "desconto" as const }]
          : []),
        ...(Number(item.vt_desconto || 0) > 0
          ? [{ label: "Vale Transporte", ref: "—", value: Number(item.vt_desconto), type: "desconto" as const }]
          : []),
      ],
      totalBruto: Number(item.total_bruto || 0),
      totalDescontos: Number(item.total_descontos || 0),
      totalLiquido: Number(item.total_liquido || 0),
      baseInss,
      baseFgts: baseInss,
      baseIrrf,
      fgtsMes: Number(item.fgts || 0),
    });
  };

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
            <Button variant="outline" onClick={() => setEventsOpen(true)}>
              <Sparkles size={14} className="mr-1" /> Eventos variáveis
            </Button>
            <Button variant="outline" onClick={() => setDaysAdjOpen(true)}>
              <CalendarClock size={14} className="mr-1" /> Ajustar dias úteis
            </Button>
            <Button onClick={handleLock} variant="destructive"><Lock size={14} className="mr-1" /> Fechar Folha</Button>
          </>
        )}
        {selectedRun && (
          <DPExportButton onPdf={handleExportPdf} onExcel={handleExportExcel} />
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
                <TableHead>Eventos</TableHead>
                <TableHead>Líquido</TableHead>
                <TableHead>FGTS</TableHead>
                <TableHead>Encargos</TableHead>
                <TableHead className="w-12 text-center">Holerite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Clique em "Calcular" para gerar a folha</TableCell></TableRow>
              ) : (
                items.map((item: any) => {
                  const ev = eventsByEmp[item.employee_id];
                  const liquidoFinal = Number(item.total_liquido || 0) + (ev?.liquido || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-foreground">{empMap[item.employee_id]?.name || "—"}</TableCell>
                      <TableCell className="font-mono">{fmt(item.salario_base)}</TableCell>
                      <TableCell className="text-destructive font-mono">{fmt(item.inss_empregado)}</TableCell>
                      <TableCell className="text-destructive font-mono">{fmt(item.irrf)}</TableCell>
                      <TableCell className="text-destructive font-mono">{fmt(item.vt_desconto)}</TableCell>
                      <TableCell className="font-mono">
                        {ev ? (
                          <span
                            className={ev.liquido >= 0 ? "text-foreground" : "text-destructive"}
                            title={`+${fmt(ev.proventos)} / −${fmt(ev.descontos)} (${ev.count} lançamento(s))`}
                          >
                            {ev.liquido >= 0 ? "+" : "−"}{fmt(Math.abs(ev.liquido))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold">{fmt(liquidoFinal)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{fmt(item.fgts)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{fmt(item.total_encargos)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePaystub(item)}
                          title="Baixar holerite (PDF)"
                        >
                          <Download size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedRunId && selectedRun && (
        <>
          <PayrollEventsDialog
            open={eventsOpen}
            onOpenChange={setEventsOpen}
            payrollRunId={selectedRunId}
            referenceMonth={selectedRun.reference_month}
          />
          <PayrollDaysAdjustmentDialog
            open={daysAdjOpen}
            onOpenChange={setDaysAdjOpen}
            payrollRunId={selectedRunId}
            referenceMonth={selectedRun.reference_month}
          />
        </>
      )}

      {/* Histórico/comparativo das últimas folhas */}
      <DPPayrollComparison />

      {!selectedRunId && (
        <div className="text-center py-12 text-muted-foreground">
          Selecione ou crie uma folha de pagamento para começar.
        </div>
      )}
    </div>
  );
}
