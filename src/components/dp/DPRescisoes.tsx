import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Eye } from "lucide-react";
import { useEmployees, useTerminations } from "@/hooks/useDP";
import { format } from "date-fns";
import TerminationSimulatorDialog, { TERM_TYPES, PJ_TERM_TYPES } from "./TerminationSimulatorDialog";
import TerminationDetailsDialog from "./TerminationDetailsDialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { generateDPExcelReport, generateDPPdfReport } from "@/lib/dpExports";

const ALL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  [...TERM_TYPES, ...PJ_TERM_TYPES].map((t) => [t.value, t.label]),
);

export default function DPRescisoes() {
  const { data: employees = [] } = useEmployees();
  const { data: terminations = [] } = useTerminations();
  const { currentOrg } = useOrganization();

  const [simOpen, setSimOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTermination, setSelectedTermination] = useState<any | null>(null);

  const openDetails = (t: any) => {
    setSelectedTermination(t);
    setDetailsOpen(true);
  };

  const empMap = useMemo(() => {
    const m: Record<string, any> = {};
    employees.forEach((e: any) => { m[e.id] = e; });
    return m;
  }, [employees]);

  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totals = useMemo(() => {
    return terminations.reduce(
      (acc: any, t: any) => {
        acc.total += Number(t.total_rescisao || 0);
        acc.multa += Number(t.multa_fgts || 0);
        return acc;
      },
      { total: 0, multa: 0 },
    );
  }, [terminations]);

  const exportPdf = () => {
    generateDPPdfReport({
      title: "Rescisões — Histórico",
      orgName: currentOrg?.name || "—",
      period: `Total de ${terminations.length} rescisão(ões)`,
      summary: [
        { label: "Total Rescisões", value: fmt(totals.total) },
        { label: "Multa FGTS Total", value: fmt(totals.multa) },
        { label: "Quantidade", value: String(terminations.length) },
      ],
      columns: ["Colaborador", "Regime", "Data", "Tipo", "Total Rescisão", "Multa FGTS", "Status"],
      rows: terminations.map((t: any) => {
        const emp = empMap[t.employee_id];
        const regime = t.contract_type || emp?.contract_type || "—";
        return [
          emp?.name || "—",
          regime,
          format(new Date(t.termination_date), "dd/MM/yyyy"),
          ALL_TYPE_LABELS[t.type] || t.type,
          fmt(t.total_rescisao),
          regime === "PJ" || regime === "estagio" ? "—" : fmt(t.multa_fgts),
          t.status,
        ];
      }),
    });
  };

  const exportExcel = () => {
    generateDPExcelReport({
      title: "Rescisoes",
      sheets: [
        {
          name: "Rescisões",
          rows: [
            ["Colaborador", "Regime", "Data", "Tipo", "Saldo Salário", "Aviso Prévio", "Férias Prop.", "1/3 Férias", "13º Prop.", "Multa FGTS", "Total Rescisão", "Status"],
            ...terminations.map((t: any) => {
              const emp = empMap[t.employee_id];
              return [
                emp?.name || "—",
                t.contract_type || emp?.contract_type || "—",
                t.termination_date,
                ALL_TYPE_LABELS[t.type] || t.type,
                Number(t.saldo_salario || 0),
                Number(t.aviso_previo || 0),
                Number(t.ferias_proporcionais || 0),
                Number(t.terco_ferias || 0),
                Number(t.decimo_terceiro_proporcional || 0),
                Number(t.multa_fgts || 0),
                Number(t.total_rescisao || 0),
                t.status,
              ];
            }),
          ],
        },
      ],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button onClick={() => setSimOpen(true)}>
          <Calculator size={14} className="mr-1" /> Simular Desligamento
        </Button>
        <DPExportButton onPdf={exportPdf} onExcel={exportExcel} disabled={terminations.length === 0} />
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
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline">{ALL_TYPE_LABELS[t.type] || t.type}</Badge>
                            {t.hr_planning_item_id && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] bg-primary/10 text-primary border border-primary/30"
                                title="Originado de um item de Planejamento de RH"
                              >
                                planejado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
