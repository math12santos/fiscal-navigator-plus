import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Line, ComposedChart,
} from "recharts";
import { AlertTriangle, Calculator, TrendingUp } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function TicketSimulator() {
  // Input parameters
  const [ticketMin, setTicketMin] = useState(2000);
  const [ticketMax, setTicketMax] = useState(15000);
  const [steps, setSteps] = useState(5);
  const [leadsPerMonth, setLeadsPerMonth] = useState(100);
  const [convRate, setConvRate] = useState(5);
  const [custoFixoMensal, setCustoFixoMensal] = useState(25000);
  const [custoVariavelPct, setCustoVariavelPct] = useState(15);
  const [comissaoPct, setComissaoPct] = useState(8);
  const [periodoMeses, setPeriodoMeses] = useState(12);

  const simData = useMemo(() => {
    const increment = steps > 1 ? (ticketMax - ticketMin) / (steps - 1) : 0;
    return Array.from({ length: steps }, (_, i) => {
      const ticket = Math.round(ticketMin + increment * i);
      const vendasMes = Math.round(leadsPerMonth * (convRate / 100));
      const receitaMes = vendasMes * ticket;
      const receitaTotal = receitaMes * periodoMeses;
      const custoFixoTotal = custoFixoMensal * periodoMeses;
      const custoVariavel = receitaTotal * (custoVariavelPct / 100);
      const comissao = receitaTotal * (comissaoPct / 100);
      const custoTotal = custoFixoTotal + custoVariavel + comissao;
      const lucro = receitaTotal - custoTotal;
      const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0;
      const roi = custoTotal > 0 ? ((receitaTotal - custoTotal) / custoTotal) * 100 : 0;
      const payback = receitaMes > 0 ? custoFixoTotal / (receitaMes - (receitaMes * (custoVariavelPct + comissaoPct) / 100)) : Infinity;

      return {
        ticket,
        vendasMes,
        receitaMes,
        receitaTotal,
        custoTotal,
        lucro,
        margem,
        roi,
        payback: payback > 0 && payback !== Infinity ? payback : Infinity,
        label: fmt(ticket),
      };
    });
  }, [ticketMin, ticketMax, steps, leadsPerMonth, convRate, custoFixoMensal, custoVariavelPct, comissaoPct, periodoMeses]);

  return (
    <div className="space-y-6">
      {/* Mockup badge */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs gap-1 border-warning/40 text-warning">
          <AlertTriangle className="h-3 w-3" /> Mockup — Em desenvolvimento
        </Badge>
        <p className="text-xs text-muted-foreground">
          Simulador de projeção por faixa de ticket médio. Métricas de capacidade produtiva serão integradas em breve.
        </p>
      </div>

      {/* Parameters */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Parâmetros da Simulação</h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <Label className="text-[10px] text-muted-foreground">Ticket Mínimo (R$)</Label>
            <Input className="h-8 text-xs" type="number" value={ticketMin} onChange={(e) => setTicketMin(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Ticket Máximo (R$)</Label>
            <Input className="h-8 text-xs" type="number" value={ticketMax} onChange={(e) => setTicketMax(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Faixas de Simulação</Label>
            <div className="flex items-center gap-2">
              <Slider value={[steps]} onValueChange={([v]) => setSteps(v)} min={2} max={10} step={1} className="flex-1" />
              <span className="text-xs font-mono w-6 text-right">{steps}</span>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Período (meses)</Label>
            <Input className="h-8 text-xs" type="number" value={periodoMeses} onChange={(e) => setPeriodoMeses(Number(e.target.value))} />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <Label className="text-[10px] text-muted-foreground">Leads/mês</Label>
            <Input className="h-8 text-xs" type="number" value={leadsPerMonth} onChange={(e) => setLeadsPerMonth(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Taxa de Conversão (%)</Label>
            <Input className="h-8 text-xs" type="number" value={convRate} onChange={(e) => setConvRate(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Custo Fixo Mensal (R$)</Label>
            <Input className="h-8 text-xs" type="number" value={custoFixoMensal} onChange={(e) => setCustoFixoMensal(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Custo Variável (% Receita)</Label>
            <Input className="h-8 text-xs" type="number" value={custoVariavelPct} onChange={(e) => setCustoVariavelPct(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <Label className="text-[10px] text-muted-foreground">Comissão (%)</Label>
            <Input className="h-8 text-xs" type="number" value={comissaoPct} onChange={(e) => setComissaoPct(Number(e.target.value))} />
          </div>
          <div className="col-span-3 flex items-end">
            <p className="text-[10px] text-muted-foreground italic">
              ⚠ Capacidade produtiva não considerada nesta simulação. Integração futura com módulo de operações.
            </p>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="glass-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Ticket Médio</TableHead>
              <TableHead className="text-xs text-right">Vendas/mês</TableHead>
              <TableHead className="text-xs text-right">Receita/mês</TableHead>
              <TableHead className="text-xs text-right">Receita Total</TableHead>
              <TableHead className="text-xs text-right">Custo Total</TableHead>
              <TableHead className="text-xs text-right">Lucro</TableHead>
              <TableHead className="text-xs text-right">Margem</TableHead>
              <TableHead className="text-xs text-right">ROI</TableHead>
              <TableHead className="text-xs text-right">Payback</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {simData.map((row) => (
              <TableRow key={row.ticket}>
                <TableCell className="text-xs font-mono font-medium">{fmt(row.ticket)}</TableCell>
                <TableCell className="text-xs text-right">{row.vendasMes}</TableCell>
                <TableCell className="text-xs text-right font-mono">{fmt(row.receitaMes)}</TableCell>
                <TableCell className="text-xs text-right font-mono">{fmt(row.receitaTotal)}</TableCell>
                <TableCell className="text-xs text-right font-mono">{fmt(row.custoTotal)}</TableCell>
                <TableCell className={`text-xs text-right font-mono font-bold ${row.lucro >= 0 ? "text-success" : "text-destructive"}`}>
                  {fmt(row.lucro)}
                </TableCell>
                <TableCell className={`text-xs text-right ${row.margem >= 0 ? "text-success" : "text-destructive"}`}>
                  {fmtPct(row.margem)}
                </TableCell>
                <TableCell className={`text-xs text-right font-bold ${row.roi >= 0 ? "text-success" : "text-destructive"}`}>
                  {fmtPct(row.roi)}
                </TableCell>
                <TableCell className="text-xs text-right">
                  {row.payback === Infinity ? "∞" : `${row.payback.toFixed(1)}m`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Chart */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h5 className="text-xs font-semibold">Receita × Lucro por Ticket Médio</h5>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={simData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis
              yAxisId="left"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <Tooltip
              formatter={(v: number, name: string) => {
                if (name === "margem") return [fmtPct(v), "Margem"];
                return [fmt(v), name === "receitaTotal" ? "Receita" : "Lucro"];
              }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="receitaTotal" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="lucro" name="Lucro" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" dataKey="margem" name="Margem (%)" stroke="hsl(var(--destructive))" dot={{ r: 3 }} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
