import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployees, useDPConfig, calcEncargosPatronais } from "@/hooks/useDP";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { generateDPExcelReport, generateDPPdfReport } from "@/lib/dpExports";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DPEncargos() {
  const { data: employees = [] } = useEmployees();
  const { data: dpConfig } = useDPConfig();
  const { currentOrg } = useOrganization();

  const activeEmps = employees.filter((e: any) => e.status === "ativo");

  const encargosData = useMemo(() => {
    return activeEmps.map((emp: any) => {
      const salario = Number(emp.salary_base || 0);
      const enc = calcEncargosPatronais(salario, dpConfig, emp.contract_type);
      return { ...emp, salario, ...enc };
    });
  }, [activeEmps, dpConfig]);

  const totals = useMemo(() => {
    return encargosData.reduce((acc, e) => ({
      salario: acc.salario + e.salario,
      inssPatronal: acc.inssPatronal + e.inssPatronal,
      rat: acc.rat + e.rat,
      fgts: acc.fgts + e.fgts,
      terceiros: acc.terceiros + e.terceiros,
      total: acc.total + e.total,
    }), { salario: 0, inssPatronal: 0, rat: 0, fgts: 0, terceiros: 0, total: 0 });
  }, [encargosData]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const period = format(new Date(), "MMMM/yyyy", { locale: ptBR });

  const exportPdf = () => {
    generateDPPdfReport({
      title: "Encargos Sociais Patronais",
      orgName: currentOrg?.name || "—",
      period,
      summary: [
        { label: "INSS Patronal", value: fmt(totals.inssPatronal) },
        { label: "RAT", value: fmt(totals.rat) },
        { label: "FGTS", value: fmt(totals.fgts) },
        { label: "Terceiros", value: fmt(totals.terceiros) },
        { label: "Total", value: fmt(totals.total) },
      ],
      columns: ["Colaborador", "Salário", "INSS Patr.", "RAT", "FGTS", "Terceiros", "Total"],
      rows: encargosData.map((e) => [e.name, fmt(e.salario), fmt(e.inssPatronal), fmt(e.rat), fmt(e.fgts), fmt(e.terceiros), fmt(e.total)]),
    });
  };

  const exportExcel = () => {
    generateDPExcelReport({
      title: "Encargos Sociais",
      sheets: [
        {
          name: "Encargos por Colaborador",
          rows: [
            ["Colaborador", "Tipo Contrato", "Salário", "INSS Patronal", "RAT", "FGTS", "Terceiros", "Total Encargos", "% sobre Salário"],
            ...encargosData.map((e: any) => [
              e.name, e.contract_type, e.salario, e.inssPatronal, e.rat, e.fgts, e.terceiros, e.total,
              e.salario > 0 ? Number(((e.total / e.salario) * 100).toFixed(2)) : 0,
            ]),
            ["TOTAL", "", totals.salario, totals.inssPatronal, totals.rat, totals.fgts, totals.terceiros, totals.total, ""],
          ],
        },
      ],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <DPExportButton onPdf={exportPdf} onExcel={exportExcel} disabled={encargosData.length === 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">INSS Patronal</p><p className="font-bold text-foreground">{fmt(totals.inssPatronal)}</p><p className="text-[10px] text-muted-foreground">{dpConfig?.inss_patronal_pct ?? 20}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">RAT</p><p className="font-bold text-foreground">{fmt(totals.rat)}</p><p className="text-[10px] text-muted-foreground">{dpConfig?.rat_pct ?? 2}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">FGTS</p><p className="font-bold text-foreground">{fmt(totals.fgts)}</p><p className="text-[10px] text-muted-foreground">{dpConfig?.fgts_pct ?? 8}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Terceiros</p><p className="font-bold text-foreground">{fmt(totals.terceiros)}</p><p className="text-[10px] text-muted-foreground">{dpConfig?.terceiros_pct ?? 5.8}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Detalhamento por Colaborador</span>
            <span className="text-xs text-muted-foreground font-normal">Total encargos: {fmt(totals.total)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>INSS Patronal</TableHead>
                  <TableHead>RAT</TableHead>
                  <TableHead>FGTS</TableHead>
                  <TableHead>Terceiros</TableHead>
                  <TableHead>Total Encargos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {encargosData.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum colaborador ativo</TableCell></TableRow>
                ) : (
                  <>
                    {encargosData.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium text-foreground">{e.name}</TableCell>
                        <TableCell className="font-mono">{fmt(e.salario)}</TableCell>
                        <TableCell className="font-mono">{fmt(e.inssPatronal)}</TableCell>
                        <TableCell className="font-mono">{fmt(e.rat)}</TableCell>
                        <TableCell className="font-mono">{fmt(e.fgts)}</TableCell>
                        <TableCell className="font-mono">{fmt(e.terceiros)}</TableCell>
                        <TableCell className="font-mono font-bold">{fmt(e.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="font-mono">{fmt(totals.salario)}</TableCell>
                      <TableCell className="font-mono">{fmt(totals.inssPatronal)}</TableCell>
                      <TableCell className="font-mono">{fmt(totals.rat)}</TableCell>
                      <TableCell className="font-mono">{fmt(totals.fgts)}</TableCell>
                      <TableCell className="font-mono">{fmt(totals.terceiros)}</TableCell>
                      <TableCell className="font-mono">{fmt(totals.total)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
