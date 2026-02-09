import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { useCashFlow, CashFlowEntry } from "@/hooks/useCashFlow";
import { KPICard } from "@/components/KPICard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts";
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, ChevronLeft, ChevronRight,
  Loader2, CheckCircle, Clock, Circle, CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

const statusConfig: Record<string, { icon: typeof Circle; class: string; label: string }> = {
  previsto: { icon: Clock, class: "text-muted-foreground", label: "Previsto" },
  confirmado: { icon: CheckCircle, class: "text-warning", label: "Confirmado" },
  pago: { icon: CheckCircle, class: "text-success", label: "Pago" },
  cancelado: { icon: Circle, class: "text-destructive", label: "Cancelado" },
};

type DateCycle = "mensal" | "bimestral" | "trimestral" | "semestral" | "anual" | "personalizado";

const cycleOptions: { value: DateCycle; label: string; months: number }[] = [
  { value: "mensal", label: "Mensal", months: 1 },
  { value: "bimestral", label: "Bimestral", months: 2 },
  { value: "trimestral", label: "Trimestral", months: 3 },
  { value: "semestral", label: "Semestral", months: 6 },
  { value: "anual", label: "Anual", months: 12 },
  { value: "personalizado", label: "Personalizado", months: 0 },
];

function getCycleMonths(cycle: DateCycle): number {
  return cycleOptions.find((c) => c.value === cycle)?.months ?? 1;
}

function getCycleLabel(cycle: DateCycle, ref: Date, customFrom?: Date, customTo?: Date): string {
  if (cycle === "personalizado" && customFrom && customTo) {
    return `${format(customFrom, "dd/MM/yy", { locale: ptBR })} – ${format(customTo, "dd/MM/yy", { locale: ptBR })}`;
  }
  const months = getCycleMonths(cycle);
  const from = startOfMonth(ref);
  const to = endOfMonth(addMonths(from, months - 1));
  if (months === 1) return format(from, "MMMM yyyy", { locale: ptBR });
  return `${format(from, "MMM/yy", { locale: ptBR })} – ${format(to, "MMM/yy", { locale: ptBR })}`;
}

export default function FluxoCaixa() {
  const [refDate, setRefDate] = useState(new Date());
  const [cycle, setCycle] = useState<DateCycle>("mensal");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date | undefined>(endOfMonth(new Date()));

  const isCustom = cycle === "personalizado";
  const months = getCycleMonths(cycle);
  const rangeFrom = isCustom ? (customFrom ?? startOfMonth(new Date())) : startOfMonth(refDate);
  const rangeTo = isCustom ? (customTo ?? endOfMonth(new Date())) : endOfMonth(addMonths(startOfMonth(refDate), months - 1));

  const { entries, totals, isLoading } = useCashFlow(rangeFrom, rangeTo);

  const periodLabel = getCycleLabel(cycle, refDate, customFrom, customTo);

  const navigatePeriod = (direction: 1 | -1) => {
    setRefDate(direction === 1 ? addMonths(refDate, months) : subMonths(refDate, months));
  };

  // Group by day for charts
  const chartData = useMemo(() => {
    const byDay: Record<string, { dia: string; entradas: number; saidas: number; saldo: number }> = {};
    let runningBalance = 0;

    for (const e of entries) {
      const dia = format(new Date(e.data_prevista), "dd/MM");
      if (!byDay[dia]) byDay[dia] = { dia, entradas: 0, saidas: 0, saldo: 0 };
      const val = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") {
        byDay[dia].entradas += val;
        runningBalance += val;
      } else {
        byDay[dia].saidas += val;
        runningBalance -= val;
      }
      byDay[dia].saldo = runningBalance;
    }

    return Object.values(byDay).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [entries]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Fluxo de Caixa" description="Gestão do fluxo de caixa realizado e previsto" />

      {/* Period navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={cycle} onValueChange={(v) => setCycle(v as DateCycle)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cycleOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isCustom ? (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <CalendarIcon size={14} />
                  {customFrom ? format(customFrom, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <CalendarIcon size={14} />
                  {customTo ? format(customTo, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod(-1)}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center capitalize">{periodLabel}</span>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod(1)}>
              <ChevronRight size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRefDate(new Date())}>Hoje</Button>
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Entradas" value={fmt(totals.entradas)} icon={<ArrowUpCircle size={20} />} />
        <KPICard title="Total Saídas" value={fmt(totals.saidas)} icon={<ArrowDownCircle size={20} />} />
        <KPICard title="Saldo do Período" value={fmt(totals.saldo)} icon={<Wallet size={20} />} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <p>Nenhum lançamento encontrado para este período.</p>
          <p className="text-sm mt-1">Cadastre contratos com recorrência para ver as projeções automáticas.</p>
        </div>
      ) : (
        <>
          {/* Charts */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Entradas vs Saídas</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Evolução do Saldo</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="url(#saldoGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Lançamentos do Período</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Realizado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const isProjected = e.id.startsWith("proj-");
                    const sc = statusConfig[e.status] ?? statusConfig.previsto;
                    const Icon = sc.icon;
                    return (
                      <TableRow key={e.id} className={cn(isProjected && "opacity-70")}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(e.data_prevista), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>{e.descricao}</TableCell>
                        <TableCell>
                          <Badge variant={e.tipo === "entrada" ? "default" : "destructive"} className="text-xs">
                            {e.tipo === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(e.valor_previsto))}</TableCell>
                        <TableCell className="text-right font-mono">
                          {e.valor_realizado != null ? fmt(Number(e.valor_realizado)) : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={cn("flex items-center gap-1 text-xs", sc.class)}>
                            <Icon size={14} />
                            {sc.label}
                            {isProjected && <span className="text-muted-foreground ml-1">(projeção)</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">{e.source}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
