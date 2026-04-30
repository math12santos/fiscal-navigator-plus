import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useITTCO, ITCOItem } from "@/hooks/useITTCO";
import { Cloud, Laptop, FileDown, Calculator } from "lucide-react";
import { KpiBreakdownDialog } from "./KpiBreakdownDialog";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function TCOTab() {
  const { currentOrg } = useOrganization();
  const [range, setRange] = useState(defaultRange());
  const [filter, setFilter] = useState<"all" | "system" | "equipment">("all");
  const [breakdown, setBreakdown] = useState<ITCOItem | null>(null);

  const tco = useITTCO(currentOrg?.id, range.from, range.to);
  const data = tco.data ?? [];

  const filtered = useMemo(
    () => (filter === "all" ? data : data.filter((d) => d.entity_type === filter)),
    [data, filter]
  );

  const ranked = useMemo(
    () => [...filtered].sort((a, b) => b.tco_total - a.tco_total).slice(0, 50),
    [filtered]
  );

  const totals = useMemo(() => {
    const t = data.reduce(
      (acc, d) => {
        acc.direct += Number(d.direct_cost);
        acc.depr += Number(d.depreciation);
        acc.inc += Number(d.incident_cost);
        acc.mov += Number(d.movement_cost);
        acc.tco += Number(d.tco_total);
        return acc;
      },
      { direct: 0, depr: 0, inc: 0, mov: 0, tco: 0 }
    );
    return t;
  }, [data]);

  async function exportPDF() {
    const { generateITTCOReportPDF } = await import("@/lib/itTCOReportPDF");
    generateITTCOReportPDF({
      orgName: currentOrg?.name ?? "",
      from: range.from,
      to: range.to,
      items: ranked,
      totals,
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> TCO — Custo Total de Propriedade
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>De</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Todos</Button>
            <Button variant={filter === "system" ? "default" : "outline"} size="sm" onClick={() => setFilter("system")}>Sistemas</Button>
            <Button variant={filter === "equipment" ? "default" : "outline"} size="sm" onClick={() => setFilter("equipment")}>Equipamentos</Button>
          </div>
          <Button onClick={exportPDF} variant="outline" disabled={!ranked.length}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">TCO total</p><p className="text-xl font-bold">{fmt(totals.tco)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo direto</p><p className="text-lg font-semibold">{fmt(totals.direct)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Depreciação</p><p className="text-lg font-semibold">{fmt(totals.depr)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Incidentes</p><p className="text-lg font-semibold">{fmt(totals.inc)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Movimentações</p><p className="text-lg font-semibold">{fmt(totals.mov)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ranking por TCO</CardTitle></CardHeader>
        <CardContent>
          {tco.isLoading ? (
            <p className="text-sm text-muted-foreground">Calculando…</p>
          ) : ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Direto</TableHead>
                    <TableHead className="text-right">Depreciação</TableHead>
                    <TableHead className="text-right">Incidentes</TableHead>
                    <TableHead className="text-right">Movimentações</TableHead>
                    <TableHead className="text-right">TCO total</TableHead>
                    <TableHead className="text-right">TCO/usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((r) => (
                    <TableRow key={`${r.entity_type}-${r.entity_id}`} className="cursor-pointer hover:bg-muted/40" onClick={() => setBreakdown(r)}>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {r.entity_type === "system" ? <Cloud className="h-3 w-3" /> : <Laptop className="h-3 w-3" />}
                          {r.entity_type === "system" ? "Sistema" : "Equipamento"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{fmt(r.direct_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(r.depreciation)}</TableCell>
                      <TableCell className="text-right">{fmt(r.incident_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(r.movement_cost)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(r.tco_total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(r.tco_per_user)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {breakdown && (
        <KpiBreakdownDialog
          open={!!breakdown}
          onOpenChange={(o) => !o && setBreakdown(null)}
          title={`TCO — ${breakdown.name}`}
          formula="TCO = Custo direto + Depreciação + Custo de incidentes (horas × R$/h técnico) + Custo de movimentações"
          total={breakdown.tco_total}
          items={[
            { label: "Custo direto (cashflow)", value: Number(breakdown.direct_cost) },
            { label: "Depreciação no período", value: Number(breakdown.depreciation) },
            { label: "Incidentes/tickets", value: Number(breakdown.incident_cost) },
            { label: "Movimentações logísticas", value: Number(breakdown.movement_cost) },
          ]}
        />
      )}
    </div>
  );
}
