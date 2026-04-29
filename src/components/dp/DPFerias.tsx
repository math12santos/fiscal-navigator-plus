import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEmployees, useVacations } from "@/hooks/useDP";
import { addYears, differenceInMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarPlus, CheckCircle2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { generateDPExcelReport, generateDPPdfReport } from "@/lib/dpExports";
import {
  computeEmployeeVacationSummary,
  formatMonthsUntil,
  statusLabel,
  type EmployeeVacationSummary,
  type VacationStatus,
} from "@/lib/vacationCalculations";
import RegisterVacationDialog from "./RegisterVacationDialog";

function statusVariant(s: VacationStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
    case "vencido_em_dobro":
      return "destructive";
    case "proximo_vencimento":
      return "secondary";
    case "agendado":
      return "default";
    case "gozado":
      return "outline";
    default:
      return "outline";
  }
}

export default function DPFerias() {
  const { data: employees = [] } = useEmployees();
  const { data: vacations = [] } = useVacations();
  const { currentOrg } = useOrganization();
  const [dialogEmp, setDialogEmp] = useState<any | null>(null);

  // CLT: somente CLT tem férias remuneradas com 1/3 e provisão patronal.
  const activeEmployees = employees.filter(
    (e: any) => e.status === "ativo" && e.contract_type !== "PJ" && e.contract_type !== "estagio",
  );

  const rows = useMemo(() => {
    const today = new Date();
    return activeEmployees
      .map((emp: any) => {
        const empVacs = vacations.filter((v: any) => v.employee_id === emp.id);
        const summary: EmployeeVacationSummary = computeEmployeeVacationSummary(
          new Date(emp.admission_date),
          empVacs as any,
          today,
        );
        const salario = Number(emp.salary_base || 0);
        const provisaoMensal = salario / 12 + salario / 12 / 3;
        // Acumulado proporcional ao saldo de dias não gozados
        const provisaoAcumulada = (salario / 30) * summary.diasAcumulados * (4 / 3);
        return { emp, summary, provisaoMensal, provisaoAcumulada };
      })
      .sort((a, b) => {
        // ordena pior status primeiro
        const order: Record<VacationStatus, number> = {
          vencido_em_dobro: 0,
          proximo_vencimento: 1,
          agendado: 2,
          em_dia: 3,
          gozado: 4,
        };
        return order[a.summary.worstStatus] - order[b.summary.worstStatus];
      });
  }, [activeEmployees, vacations]);

  const decimoTerceiro = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    return activeEmployees.map((emp: any) => {
      const salario = Number(emp.salary_base || 0);
      const provisaoMensal = salario / 12;
      return {
        name: emp.name,
        salario,
        provisaoMensal,
        provisaoAcumulada: provisaoMensal * currentMonth,
      };
    });
  }, [activeEmployees]);

  const totalProvisaoFerias = rows.reduce((s, r) => s + r.provisaoMensal, 0);
  const totalProvisao13 = decimoTerceiro.reduce((s, d) => s + d.provisaoMensal, 0);
  const totalAcumulado13 = decimoTerceiro.reduce((s, d) => s + d.provisaoAcumulada, 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const period = format(new Date(), "MMMM/yyyy", { locale: ptBR });

  const exportPdf = () => {
    generateDPPdfReport({
      title: "Controle de Férias (CLT) e 13º",
      orgName: currentOrg?.name || "—",
      period,
      summary: [
        { label: "Provisão Mensal Férias", value: fmt(totalProvisaoFerias) },
        { label: "Provisão Mensal 13º", value: fmt(totalProvisao13) },
        { label: "13º Acumulado", value: fmt(totalAcumulado13) },
      ],
      columns: [
        "Colaborador",
        "PAs abertos",
        "Dias acumulados",
        "Próximo vencimento",
        "Tempo até vencer",
        "Próximas férias",
        "Status CLT",
        "Provisão acumulada",
      ],
      rows: rows.map(({ emp, summary, provisaoAcumulada }) => [
        emp.name,
        String(summary.periodosAbertos.length),
        `${summary.diasAcumulados} d`,
        summary.proximoPaAVencer ? format(summary.proximoPaAVencer.limiteConcessivo, "dd/MM/yyyy") : "—",
        summary.proximoPaAVencer ? formatMonthsUntil(summary.proximoPaAVencer.monthsUntilLimit) : "—",
        `em ${summary.proximasFeriasEm} m`,
        statusLabel(summary.worstStatus),
        fmt(provisaoAcumulada),
      ]),
    });
  };

  const exportExcel = () => {
    generateDPExcelReport({
      title: "Ferias CLT",
      sheets: [
        {
          name: "Férias",
          rows: [
            [
              "Colaborador",
              "PAs abertos",
              "Dias acumulados (não gozados)",
              "Próximo vencimento",
              "Tempo até vencer (meses)",
              "Próximas férias (meses)",
              "Status CLT",
              "Provisão Mensal",
              "Provisão Acumulada",
            ],
            ...rows.map(({ emp, summary, provisaoMensal, provisaoAcumulada }) => [
              emp.name,
              summary.periodosAbertos.length,
              summary.diasAcumulados,
              summary.proximoPaAVencer ? format(summary.proximoPaAVencer.limiteConcessivo, "dd/MM/yyyy") : "—",
              summary.proximoPaAVencer?.monthsUntilLimit ?? "—",
              summary.proximasFeriasEm,
              statusLabel(summary.worstStatus),
              provisaoMensal,
              provisaoAcumulada,
            ]),
          ],
        },
        {
          name: "13º Salário",
          rows: [
            ["Colaborador", "Salário Base", "Provisão Mensal", "Acumulado no Ano"],
            ...decimoTerceiro.map((d) => [d.name, d.salario, d.provisaoMensal, d.provisaoAcumulada]),
          ],
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <DPExportButton onPdf={exportPdf} onExcel={exportExcel} disabled={rows.length === 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Provisão Mensal Férias</p><p className="text-lg font-bold text-foreground">{fmt(totalProvisaoFerias)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Provisão Mensal 13º</p><p className="text-lg font-bold text-foreground">{fmt(totalProvisao13)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">13º Acumulado no Ano</p><p className="text-lg font-bold text-foreground">{fmt(totalAcumulado13)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Controle de Férias — CLT</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>PAs abertos</TableHead>
                  <TableHead>Dias acumulados</TableHead>
                  <TableHead>Próximo vencimento</TableHead>
                  <TableHead>Tempo até vencer</TableHead>
                  <TableHead>Próximas férias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provisão acumulada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum colaborador ativo (CLT)</TableCell></TableRow>
                ) : (
                  rows.map(({ emp, summary, provisaoAcumulada }) => {
                    const open = summary.periodosAbertos.length;
                    const isCritical = summary.worstStatus === "vencido_em_dobro" || open >= 2;
                    return (
                      <>
                        <TableRow key={emp.id} className={isCritical ? "bg-destructive/5" : undefined}>
                          <TableCell className="font-medium text-foreground">{emp.name}</TableCell>
                          <TableCell>
                            <Badge variant={open >= 2 ? "destructive" : "outline"}>
                              {open} {open === 1 ? "PA" : "PAs"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{summary.diasAcumulados} d</TableCell>
                          <TableCell className="text-xs">
                            {summary.proximoPaAVencer
                              ? format(summary.proximoPaAVencer.limiteConcessivo, "dd/MM/yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {summary.proximoPaAVencer
                              ? formatMonthsUntil(summary.proximoPaAVencer.monthsUntilLimit)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            em {summary.proximasFeriasEm} {summary.proximasFeriasEm === 1 ? "mês" : "meses"}
                            <span className="block text-[10px] text-muted-foreground">
                              {format(summary.proximasFeriasData, "dd/MM/yyyy")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(summary.worstStatus)} className="gap-1">
                              {summary.worstStatus === "vencido_em_dobro" && <AlertTriangle size={10} />}
                              {summary.worstStatus === "gozado" && <CheckCircle2 size={10} />}
                              {statusLabel(summary.worstStatus)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{fmt(provisaoAcumulada)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDialogEmp(emp)}
                              disabled={summary.periodosAbertos.length === 0}
                            >
                              <CalendarPlus size={14} className="mr-1" /> Registrar
                            </Button>
                          </TableCell>
                        </TableRow>
                        {summary.periodos.length > 0 && (
                          <TableRow key={`${emp.id}-detail`}>
                            <TableCell colSpan={9} className="bg-muted/20 py-2">
                              <Accordion type="single" collapsible>
                                <AccordionItem value="pa">
                                  <AccordionTrigger className="text-xs py-1">
                                    Detalhes dos períodos aquisitivos
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>PA</TableHead>
                                            <TableHead>Período</TableHead>
                                            <TableHead>Limite concessivo</TableHead>
                                            <TableHead>Gozados</TableHead>
                                            <TableHead>Vendidos</TableHead>
                                            <TableHead>Saldo</TableHead>
                                            <TableHead>Status</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {summary.periodos.map((p) => (
                                            <TableRow key={p.index}>
                                              <TableCell>PA {p.index}</TableCell>
                                              <TableCell className="text-xs">
                                                {format(p.inicio, "dd/MM/yyyy")} a {format(p.fim, "dd/MM/yyyy")}
                                              </TableCell>
                                              <TableCell className="text-xs">{format(p.limiteConcessivo, "dd/MM/yyyy")}</TableCell>
                                              <TableCell>{p.diasGozados} d</TableCell>
                                              <TableCell>{p.diasVendidos} d</TableCell>
                                              <TableCell>{p.diasSaldo} d</TableCell>
                                              <TableCell>
                                                <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Provisão de 13º Salário</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Salário Base</TableHead>
                  <TableHead>Provisão Mensal</TableHead>
                  <TableHead>Acumulado no Ano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decimoTerceiro.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum colaborador ativo</TableCell></TableRow>
                ) : (
                  decimoTerceiro.map((d, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                      <TableCell className="font-mono">{fmt(d.salario)}</TableCell>
                      <TableCell className="font-mono">{fmt(d.provisaoMensal)}</TableCell>
                      <TableCell className="font-mono font-bold">{fmt(d.provisaoAcumulada)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RegisterVacationDialog
        open={!!dialogEmp}
        onOpenChange={(o) => !o && setDialogEmp(null)}
        employee={dialogEmp}
        periodosAbertos={
          dialogEmp
            ? rows.find((r) => r.emp.id === dialogEmp.id)?.summary.periodosAbertos ?? []
            : []
        }
      />
    </div>
  );
}
