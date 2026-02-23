import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployees, useVacations, useDPConfig } from "@/hooks/useDP";
import { differenceInMonths, addYears, format, isBefore, addMonths } from "date-fns";
import { AlertTriangle } from "lucide-react";

export default function DPFerias() {
  const { data: employees = [] } = useEmployees();
  const { data: vacations = [] } = useVacations();
  const { data: dpConfig } = useDPConfig();

  const activeEmployees = employees.filter((e: any) => e.status === "ativo");

  // Calculate vacation status for each active employee
  const vacationData = useMemo(() => {
    const today = new Date();
    return activeEmployees.map((emp: any) => {
      const admDate = new Date(emp.admission_date);
      const monthsWorked = differenceInMonths(today, admDate);
      const currentPeriodStart = admDate;
      const currentPeriodEnd = addYears(admDate, Math.ceil(monthsWorked / 12));
      const limitDate = addMonths(currentPeriodEnd, 12); // Prazo concessivo
      const daysUntilLimit = Math.max(0, differenceInMonths(limitDate, today));
      const isUrgent = daysUntilLimit <= 3;
      const isOverdue = isBefore(limitDate, today);

      // Check if there's a vacation for this period
      const hasVacation = vacations.find((v: any) => v.employee_id === emp.id && v.status !== "cancelada");

      // Provisão mensal = salário / 12 + 1/3
      const salario = Number(emp.salary_base || 0);
      const provisaoMensal = (salario / 12) + (salario / 12 / 3);

      return {
        ...emp,
        monthsWorked,
        limitDate,
        daysUntilLimit,
        isUrgent,
        isOverdue,
        hasVacation,
        provisaoMensal,
        provisaoAcumulada: provisaoMensal * Math.min(monthsWorked, 12),
      };
    }).sort((a, b) => a.daysUntilLimit - b.daysUntilLimit);
  }, [activeEmployees, vacations]);

  // 13º provisioning
  const decimoTerceiroData = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    return activeEmployees.map((emp: any) => {
      const salario = Number(emp.salary_base || 0);
      const provisaoMensal = salario / 12;
      const provisaoAcumulada = provisaoMensal * currentMonth;
      return {
        name: emp.name,
        salario,
        provisaoMensal,
        provisaoAcumulada,
      };
    });
  }, [activeEmployees]);

  const totalProvisaoFerias = vacationData.reduce((sum, v) => sum + v.provisaoMensal, 0);
  const totalProvisao13 = decimoTerceiroData.reduce((sum, d) => sum + d.provisaoMensal, 0);
  const totalAcumulado13 = decimoTerceiroData.reduce((sum, d) => sum + d.provisaoAcumulada, 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Provisão Mensal Férias</p><p className="text-lg font-bold text-foreground">{fmt(totalProvisaoFerias)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Provisão Mensal 13º</p><p className="text-lg font-bold text-foreground">{fmt(totalProvisao13)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">13º Acumulado no Ano</p><p className="text-lg font-bold text-foreground">{fmt(totalAcumulado13)}</p></CardContent></Card>
      </div>

      {/* Férias */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Controle de Férias</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Meses Trabalhados</TableHead>
                  <TableHead>Prazo Limite</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provisão Mensal</TableHead>
                  <TableHead>Provisão Acumulada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacationData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum colaborador ativo</TableCell></TableRow>
                ) : (
                  vacationData.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium text-foreground">{v.name}</TableCell>
                      <TableCell>{v.monthsWorked} meses</TableCell>
                      <TableCell className="text-xs">{format(v.limitDate, "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        {v.isOverdue ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle size={10} /> Vencida</Badge>
                        ) : v.isUrgent ? (
                          <Badge variant="secondary" className="gap-1"><AlertTriangle size={10} /> Urgente</Badge>
                        ) : v.hasVacation ? (
                          <Badge variant="default">Agendada</Badge>
                        ) : (
                          <Badge variant="outline">Regular</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{fmt(v.provisaoMensal)}</TableCell>
                      <TableCell className="font-mono">{fmt(v.provisaoAcumulada)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 13º */}
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
                {decimoTerceiroData.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum colaborador ativo</TableCell></TableRow>
                ) : (
                  decimoTerceiroData.map((d, idx) => (
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
    </div>
  );
}
