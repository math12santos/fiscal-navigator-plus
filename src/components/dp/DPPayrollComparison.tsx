/**
 * Comparativo mês-a-mês de folhas de pagamento.
 * Mostra evolução de bruto, descontos, líquido e encargos das últimas N folhas.
 *
 * Inclui:
 *  - Tabela com variação % vs mês anterior.
 *  - Mini gráfico de barras (recharts) para evolução visual.
 *  - Botões de export (PDF/Excel) reusando dpExports.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePayrollRuns } from "@/hooks/useDP";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { dpFmt, generateDPExcelReport, generateDPPdfReport } from "@/lib/dpExports";

const MAX_MONTHS = 12;

export default function DPPayrollComparison() {
  const { data: runs = [] } = usePayrollRuns();
  const { currentOrg } = useOrganization();

  const sorted = useMemo(() => {
    return [...runs]
      .sort((a: any, b: any) => a.reference_month.localeCompare(b.reference_month))
      .slice(-MAX_MONTHS);
  }, [runs]);

  const rows = useMemo(() => {
    return sorted.map((r: any, idx: number) => {
      const prev = sorted[idx - 1];
      const variation = (key: string) => {
        if (!prev || !Number(prev[key])) return null;
        return (Number(r[key] || 0) - Number(prev[key] || 0)) / Number(prev[key]);
      };
      return {
        id: r.id,
        ref: r.reference_month,
        label: format(new Date(r.reference_month), "MMM/yy", { locale: ptBR }),
        bruto: Number(r.total_bruto || 0),
        descontos: Number(r.total_descontos || 0),
        liquido: Number(r.total_liquido || 0),
        encargos: Number(r.total_encargos || 0),
        custoTotal: Number(r.total_liquido || 0) + Number(r.total_encargos || 0),
        varBruto: variation("total_bruto"),
        varEncargos: variation("total_encargos"),
        varLiquido: variation("total_liquido"),
      };
    });
  }, [sorted]);

  const chartData = rows.map((r) => ({
    name: r.label,
    Líquido: r.liquido,
    Encargos: r.encargos,
  }));

  const exportPdf = () => {
    generateDPPdfReport({
      title: "Comparativo de Folhas (mês a mês)",
      orgName: currentOrg?.name || "—",
      period: `Últimos ${rows.length} mês(es)`,
      columns: ["Mês", "Bruto", "Descontos", "Líquido", "Encargos", "Custo Total", "Δ Líquido"],
      rows: rows.map((r) => [
        r.label,
        dpFmt.brl(r.bruto),
        dpFmt.brl(r.descontos),
        dpFmt.brl(r.liquido),
        dpFmt.brl(r.encargos),
        dpFmt.brl(r.custoTotal),
        r.varLiquido == null ? "—" : `${(r.varLiquido * 100).toFixed(1)}%`,
      ]),
    });
  };

  const exportExcel = () => {
    generateDPExcelReport({
      title: "Comparativo de Folhas",
      sheets: [
        {
          name: "Mês a Mês",
          rows: [
            ["Mês", "Bruto", "Descontos", "Líquido", "Encargos", "Custo Total", "Var % Bruto", "Var % Líquido", "Var % Encargos"],
            ...rows.map((r) => [
              r.label,
              r.bruto,
              r.descontos,
              r.liquido,
              r.encargos,
              r.custoTotal,
              r.varBruto == null ? null : Number((r.varBruto * 100).toFixed(2)),
              r.varLiquido == null ? null : Number((r.varLiquido * 100).toFixed(2)),
              r.varEncargos == null ? null : Number((r.varEncargos * 100).toFixed(2)),
            ]),
          ],
        },
      ],
    });
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Comparativo mês a mês</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma folha calculada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Comparativo mês a mês ({rows.length} mês{rows.length > 1 ? "es" : ""})</CardTitle>
        <DPExportButton onPdf={exportPdf} onExcel={exportExcel} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => dpFmt.brl(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Líquido" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Encargos" stackId="a" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-right">Encargos</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
              <TableHead className="text-right">Δ Líquido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right font-mono">{dpFmt.brl(r.bruto)}</TableCell>
                <TableCell className="text-right font-mono">{dpFmt.brl(r.liquido)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{dpFmt.brl(r.encargos)}</TableCell>
                <TableCell className="text-right font-mono font-bold">{dpFmt.brl(r.custoTotal)}</TableCell>
                <TableCell className="text-right">
                  <VarBadge value={r.varLiquido} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function VarBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = (value * 100).toFixed(1);
  if (Math.abs(value) < 0.001) {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Minus size={10} /> 0%
      </Badge>
    );
  }
  if (value > 0) {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-warning/50 text-warning">
        <TrendingUp size={10} /> +{pct}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 border-success/50 text-success">
      <TrendingDown size={10} /> {pct}%
    </Badge>
  );
}
