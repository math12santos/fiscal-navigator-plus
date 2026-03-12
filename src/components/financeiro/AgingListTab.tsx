import { useMemo, useState } from "react";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, AlertTriangle, CalendarClock, CheckCircle, ChevronRight, ChevronDown, Layers } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { useHolding } from "@/contexts/HoldingContext";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface AgingBucket {
  label: string;
  range: string;
  entries: any[];
  total: number;
  color: string;
  icon: React.ReactNode;
}

const GROUPABLE_SOURCES = ["dp"];

export function AgingListTab() {
  const { entries, isLoading } = useFinanceiro("saida");
  const { holdingMode } = useHolding();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const today = new Date();

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const { holdingMode } = useHolding();
  const today = new Date();

  const buckets = useMemo<AgingBucket[]>(() => {
    // Only pending entries (not paid, not projected DP/payroll)
    const pending = entries.filter(
      (e) => e.status === "previsto" || e.status === "confirmado"
    );

    const overdue90: any[] = [];
    const overdue60: any[] = [];
    const overdue30: any[] = [];
    const overdue0: any[] = [];
    const due7: any[] = [];
    const due30: any[] = [];
    const due60: any[] = [];
    const future: any[] = [];

    for (const e of pending) {
      const dueDate = parseISO((e as any).data_vencimento || e.data_prevista);
      const days = differenceInDays(dueDate, today);

      if (days < -90) overdue90.push(e);
      else if (days < -60) overdue60.push(e);
      else if (days < -30) overdue30.push(e);
      else if (days < 0) overdue0.push(e);
      else if (days <= 7) due7.push(e);
      else if (days <= 30) due30.push(e);
      else if (days <= 60) due60.push(e);
      else future.push(e);
    }

    const sum = (arr: any[]) => arr.reduce((s, e) => s + Number(e.valor_previsto), 0);

    return [
      { label: "Vencido > 90d", range: "> 90 dias", entries: overdue90, total: sum(overdue90), color: "text-destructive", icon: <AlertTriangle className="h-4 w-4" /> },
      { label: "Vencido 61-90d", range: "61–90 dias", entries: overdue60, total: sum(overdue60), color: "text-destructive", icon: <AlertTriangle className="h-4 w-4" /> },
      { label: "Vencido 31-60d", range: "31–60 dias", entries: overdue30, total: sum(overdue30), color: "text-orange-500", icon: <Clock className="h-4 w-4" /> },
      { label: "Vencido 1-30d", range: "1–30 dias", entries: overdue0, total: sum(overdue0), color: "text-yellow-500", icon: <Clock className="h-4 w-4" /> },
      { label: "Vence em 7d", range: "0–7 dias", entries: due7, total: sum(due7), color: "text-warning", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Vence em 30d", range: "8–30 dias", entries: due30, total: sum(due30), color: "text-muted-foreground", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Vence em 60d", range: "31–60 dias", entries: due60, total: sum(due60), color: "text-muted-foreground", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Futuro > 60d", range: "> 60 dias", entries: future, total: sum(future), color: "text-muted-foreground", icon: <CheckCircle className="h-4 w-4" /> },
    ];
  }, [entries, today]);

  const totalOverdue = buckets.slice(0, 4).reduce((s, b) => s + b.total, 0);
  const totalDue = buckets.slice(4).reduce((s, b) => s + b.total, 0);
  const countOverdue = buckets.slice(0, 4).reduce((s, b) => s + b.entries.length, 0);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total Vencido"
          value={fmt(totalOverdue)}
          icon={<AlertTriangle size={20} />}
          subtitle={`${countOverdue} título(s)`}
        />
        <KPICard
          title="A Vencer"
          value={fmt(totalDue)}
          icon={<CalendarClock size={20} />}
        />
        <KPICard
          title="Total Pendente"
          value={fmt(totalOverdue + totalDue)}
          icon={<Clock size={20} />}
        />
      </div>

      {/* Aging buckets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {buckets.map((b) => (
          <Card key={b.label} className={b.entries.length > 0 ? "" : "opacity-50"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={b.color}>{b.icon}</span>
                <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
              </div>
              <p className={`text-lg font-bold ${b.color}`}>{fmt(b.total)}</p>
              <p className="text-xs text-muted-foreground">{b.entries.length} título(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail table for overdue items */}
      {countOverdue > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Títulos Vencidos ({countOverdue})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias Atraso</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {holdingMode && <TableHead>Empresa</TableHead>}
                  <TableHead>Faixa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.slice(0, 4).flatMap((b) => {
                  // Group DP/Pessoal entries within each bucket
                  const grouped = new Map<string, any[]>();
                  const singles: any[] = [];

                  for (const e of b.entries) {
                    if (GROUPABLE_SOURCES.includes(e.source) || (e.categoria === "Pessoal")) {
                      const month = format(new Date(e.data_prevista), "yyyy-MM");
                      const key = `aging-${b.label}-${e.categoria ?? e.source}-${month}`;
                      if (!grouped.has(key)) grouped.set(key, []);
                      grouped.get(key)!.push(e);
                    } else {
                      singles.push(e);
                    }
                  }

                  const rows: React.ReactNode[] = [];

                  // Render grouped rows
                  for (const [key, items] of grouped) {
                    if (items.length >= 2) {
                      const totalVal = items.reduce((s: number, e: any) => s + Number(e.valor_previsto), 0);
                      const cat = items[0].categoria ?? "Pessoal";
                      const month = format(new Date(items[0].data_prevista), "MM/yyyy");
                      const isExpanded = expandedGroups.has(key);

                      rows.push(
                        <TableRow key={key} className="cursor-pointer hover:bg-muted/50 font-medium" onClick={() => toggleGroup(key)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                              {cat} — {month}
                              <Badge variant="secondary" className="text-xs font-normal">{items.length} itens</Badge>
                            </div>
                          </TableCell>
                          <TableCell>—</TableCell>
                          <TableCell><Badge variant="destructive">{b.range}</Badge></TableCell>
                          <TableCell className="text-right font-bold">{fmt(totalVal)}</TableCell>
                          {holdingMode && <TableCell>—</TableCell>}
                          <TableCell><Badge variant="secondary" className="text-xs">{b.range}</Badge></TableCell>
                        </TableRow>
                      );

                      if (isExpanded) {
                        for (const e of items) {
                          const dueDate = parseISO((e as any).data_vencimento || e.data_prevista);
                          const days = Math.abs(differenceInDays(dueDate, today));
                          rows.push(
                            <TableRow key={e.id} className="bg-muted/30">
                              <TableCell className="pl-10 font-medium max-w-[200px] truncate">{e.descricao}</TableCell>
                              <TableCell>{format(dueDate, "dd/MM/yyyy")}</TableCell>
                              <TableCell><Badge variant="destructive">{days}d</Badge></TableCell>
                              <TableCell className="text-right font-medium">{fmt(Number(e.valor_previsto))}</TableCell>
                              {holdingMode && (
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    {e.organization_id?.slice(0, 8)}
                                  </Badge>
                                </TableCell>
                              )}
                              <TableCell><Badge variant="secondary" className="text-xs">{b.range}</Badge></TableCell>
                            </TableRow>
                          );
                        }
                      }
                    } else {
                      singles.push(...items);
                    }
                  }

                  // Render singles
                  for (const e of singles) {
                    const dueDate = parseISO((e as any).data_vencimento || e.data_prevista);
                    const days = Math.abs(differenceInDays(dueDate, today));
                    rows.push(
                      <TableRow key={e.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{e.descricao}</TableCell>
                        <TableCell>{format(dueDate, "dd/MM/yyyy")}</TableCell>
                        <TableCell><Badge variant="destructive">{days}d</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(e.valor_previsto))}</TableCell>
                        {holdingMode && (
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {e.organization_id?.slice(0, 8)}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell><Badge variant="secondary" className="text-xs">{b.range}</Badge></TableCell>
                      </TableRow>
                    );
                  }

                  return rows;
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
