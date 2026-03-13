import { useMemo, useState } from "react";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, AlertTriangle, CalendarClock, CheckCircle, ChevronRight, ChevronDown, Layers, TrendingUp, Landmark, Wallet, ShieldCheck, FolderOpen } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { useHolding } from "@/contexts/HoldingContext";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGroupingRules } from "@/hooks/useGroupingRules";
import { useGroupingMacrogroups } from "@/hooks/useGroupingMacrogroups";
import { buildHierarchy } from "@/lib/groupingHierarchy";

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

export function AgingListTab() {
  const { entries: saidaEntries, isLoading: saidaLoading } = useFinanceiro("saida");
  const { entries: entradaEntries, isLoading: entradaLoading } = useFinanceiro("entrada");
  const { bankAccounts, isLoading: bankLoading } = useBankAccounts();
  const { getMatchingRule, getGroupLabel } = useGroupingRules();
  const { macrogroups, groups } = useGroupingMacrogroups();
  const { holdingMode } = useHolding();
  const [expandedMacrogroups, setExpandedMacrogroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const today = new Date();

  const isLoading = saidaLoading || entradaLoading || bankLoading;

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Receivables (AR) buckets ──
  const arBuckets = useMemo(() => {
    const pending = entradaEntries.filter(
      (e) => e.status === "previsto" || e.status === "confirmado"
    );
    const ar7: any[] = [];
    const ar15: any[] = [];
    const ar30: any[] = [];
    const arFuture: any[] = [];

    for (const e of pending) {
      const dueDate = parseISO((e as any).data_vencimento || e.data_prevista);
      const days = differenceInDays(dueDate, today);
      if (days < 0) continue;
      if (days <= 7) ar7.push(e);
      else if (days <= 15) ar15.push(e);
      else if (days <= 30) ar30.push(e);
      else arFuture.push(e);
    }

    const sum = (arr: any[]) => arr.reduce((s: number, e: any) => s + Number(e.valor_previsto), 0);

    return {
      ar7: { entries: ar7, total: sum(ar7) },
      ar15: { entries: ar15, total: sum(ar15) },
      ar30: { entries: ar30, total: sum(ar30) },
      arFuture: { entries: arFuture, total: sum(arFuture) },
      totalAR: sum(ar7) + sum(ar15) + sum(ar30) + sum(arFuture),
    };
  }, [entradaEntries, today]);

  // ── Bank balances ──
  const bankTotals = useMemo(() => {
    const saldoTotal = bankAccounts.reduce((s, b) => s + Number(b.saldo_atual ?? 0), 0);
    const limiteTotal = bankAccounts.reduce((s, b) => s + Number(b.limite_credito ?? 0), 0);
    return { saldoTotal, limiteTotal, disponibilidadeTotal: saldoTotal + limiteTotal };
  }, [bankAccounts]);

  // ── AP Aging buckets ──
  const buckets = useMemo<AgingBucket[]>(() => {
    const pending = saidaEntries.filter(
      (e) => e.status === "previsto" || e.status === "confirmado"
    );

    const overdue90: any[] = [];
    const overdue60: any[] = [];
    const overdue30: any[] = [];
    const overdue0: any[] = [];
    const due7: any[] = [];
    const due15: any[] = [];
    const due30: any[] = [];
    const future: any[] = [];

    for (const e of pending) {
      const dueDate = parseISO((e as any).data_vencimento || e.data_prevista);
      const days = differenceInDays(dueDate, today);

      if (days < -90) overdue90.push(e);
      else if (days < -60) overdue60.push(e);
      else if (days < -30) overdue30.push(e);
      else if (days < 0) overdue0.push(e);
      else if (days <= 7) due7.push(e);
      else if (days <= 15) due15.push(e);
      else if (days <= 30) due30.push(e);
      else future.push(e);
    }

    const sum = (arr: any[]) => arr.reduce((s: number, e: any) => s + Number(e.valor_previsto), 0);

    return [
      { label: "Vencido > 90d", range: "> 90 dias", entries: overdue90, total: sum(overdue90), color: "text-destructive", icon: <AlertTriangle className="h-4 w-4" /> },
      { label: "Vencido 61-90d", range: "61–90 dias", entries: overdue60, total: sum(overdue60), color: "text-destructive", icon: <AlertTriangle className="h-4 w-4" /> },
      { label: "Vencido 31-60d", range: "31–60 dias", entries: overdue30, total: sum(overdue30), color: "text-orange-500", icon: <Clock className="h-4 w-4" /> },
      { label: "Vencido 1-30d", range: "1–30 dias", entries: overdue0, total: sum(overdue0), color: "text-yellow-500", icon: <Clock className="h-4 w-4" /> },
      { label: "Vence em 7d", range: "0–7 dias", entries: due7, total: sum(due7), color: "text-warning", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Vence em 15d", range: "8–15 dias", entries: due15, total: sum(due15), color: "text-muted-foreground", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Vence em 30d", range: "16–30 dias", entries: due30, total: sum(due30), color: "text-muted-foreground", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Futuro > 30d", range: "> 30 dias", entries: future, total: sum(future), color: "text-muted-foreground", icon: <CheckCircle className="h-4 w-4" /> },
    ];
  }, [saidaEntries, today]);

  const totalOverdue = buckets.slice(0, 4).reduce((s, b) => s + b.total, 0);
  const totalDue = buckets.slice(4).reduce((s, b) => s + b.total, 0);
  const countOverdue = buckets.slice(0, 4).reduce((s, b) => s + b.entries.length, 0);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  /** Render a single entry row */
  const renderEntry = (e: any, b: AgingBucket, indent = 0) => {
    const dueDate = parseISO((e as any).data_vencimento || e.data_prevista);
    const days = Math.abs(differenceInDays(dueDate, today));
    return (
      <TableRow key={e.id} className={cn(indent > 0 && "bg-muted/30", indent > 1 && "bg-muted/15")}>
        <TableCell className={cn("font-medium max-w-[200px] truncate", indent === 1 && "pl-10", indent === 2 && "pl-16")}>
          {e.descricao}
        </TableCell>
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
  };

  /** Build 3-level grouped rows for a bucket */
  const renderBucketRows = (b: AgingBucket) => {
    if (b.entries.length === 0) return [];

    const hierarchy = buildHierarchy(
      b.entries, getMatchingRule, getGroupLabel, groups, macrogroups
    );

    const rows: React.ReactNode[] = [];

    for (const mgBucket of hierarchy) {
      const mgKey = `aging-${b.label}-mg-${mgBucket.info.macrogroupId}`;
      const isMgExpanded = expandedMacrogroups.has(mgKey);
      const mgGroups = Array.from(mgBucket.groups.values());

      // Level 0 — Macrogroup header
      rows.push(
        <TableRow
          key={mgKey}
          className="cursor-pointer hover:bg-muted/50 font-semibold"
          onClick={() => toggle(setExpandedMacrogroups, mgKey)}
        >
          <TableCell>
            <div className="flex items-center gap-2">
              {isMgExpanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: mgBucket.info.macrogroupColor }}
              />
              {mgBucket.info.macrogroupName}
              <Badge variant="secondary" className="text-xs font-normal">
                {mgBucket.entries.length} itens
              </Badge>
            </div>
          </TableCell>
          <TableCell>—</TableCell>
          <TableCell><Badge variant="destructive">{b.range}</Badge></TableCell>
          <TableCell className="text-right font-bold">{fmt(mgBucket.total)}</TableCell>
          {holdingMode && <TableCell>—</TableCell>}
          <TableCell><Badge variant="secondary" className="text-xs">{b.range}</Badge></TableCell>
        </TableRow>
      );

      if (!isMgExpanded) continue;

      // Level 1 — Group headers
      for (const grpBucket of mgGroups) {
        const grpKey = `${mgKey}__${grpBucket.info.groupId}`;
        const isGrpExpanded = expandedGroups.has(grpKey);

        rows.push(
          <TableRow
            key={grpKey}
            className="cursor-pointer hover:bg-muted/40 bg-muted/30"
            onClick={(ev) => { ev.stopPropagation(); toggle(setExpandedGroups, grpKey); }}
          >
            <TableCell className="pl-8">
              <div className="flex items-center gap-2">
                {isGrpExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                {grpBucket.info.groupName}
                <Badge variant="secondary" className="text-xs font-normal">
                  {grpBucket.entries.length}
                </Badge>
              </div>
            </TableCell>
            <TableCell>—</TableCell>
            <TableCell />
            <TableCell className="text-right font-semibold">{fmt(grpBucket.total)}</TableCell>
            {holdingMode && <TableCell />}
            <TableCell />
          </TableRow>
        );

        // Level 2 — Individual entries
        if (isGrpExpanded) {
          for (const entry of grpBucket.entries) {
            rows.push(renderEntry(entry, b, 2));
          }
        }
      }
    }

    return rows;
  };

  return (
    <div className="space-y-6">
      {/* ── Cash Position & Availability ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Saldo em Contas" value={fmt(bankTotals.saldoTotal)} icon={<Landmark size={20} />} subtitle={`${bankAccounts.length} conta(s)`} />
        <KPICard title="Limite de Crédito" value={fmt(bankTotals.limiteTotal)} icon={<ShieldCheck size={20} />} />
        <KPICard title="Disponibilidade Total" value={fmt(bankTotals.disponibilidadeTotal)} icon={<Wallet size={20} />} subtitle="Saldo + Limite" />
        <KPICard title="Entradas Previstas" value={fmt(arBuckets.totalAR)} icon={<TrendingUp size={20} />} subtitle={`${entradaEntries.filter(e => (e.status === "previsto" || e.status === "confirmado") && differenceInDays(parseISO((e as any).data_vencimento || e.data_prevista), today) >= 0).length} título(s)`} />
      </div>

      {/* ── AR Receivables Forecast ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={arBuckets.ar7.entries.length > 0 ? "" : "opacity-50"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-success"><TrendingUp className="h-4 w-4" /></span>
              <span className="text-xs font-medium text-muted-foreground">Receber em 7d</span>
            </div>
            <p className="text-lg font-bold text-success">{fmt(arBuckets.ar7.total)}</p>
            <p className="text-xs text-muted-foreground">{arBuckets.ar7.entries.length} título(s)</p>
          </CardContent>
        </Card>
        <Card className={arBuckets.ar15.entries.length > 0 ? "" : "opacity-50"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-success"><TrendingUp className="h-4 w-4" /></span>
              <span className="text-xs font-medium text-muted-foreground">Receber em 15d</span>
            </div>
            <p className="text-lg font-bold text-success">{fmt(arBuckets.ar15.total)}</p>
            <p className="text-xs text-muted-foreground">{arBuckets.ar15.entries.length} título(s)</p>
          </CardContent>
        </Card>
        <Card className={arBuckets.ar30.entries.length > 0 ? "" : "opacity-50"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-success/70"><TrendingUp className="h-4 w-4" /></span>
              <span className="text-xs font-medium text-muted-foreground">Receber em 30d</span>
            </div>
            <p className="text-lg font-bold text-success/70">{fmt(arBuckets.ar30.total)}</p>
            <p className="text-xs text-muted-foreground">{arBuckets.ar30.entries.length} título(s)</p>
          </CardContent>
        </Card>
        <Card className={arBuckets.arFuture.entries.length > 0 ? "" : "opacity-50"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-muted-foreground"><CalendarClock className="h-4 w-4" /></span>
              <span className="text-xs font-medium text-muted-foreground">Receber &gt; 30d</span>
            </div>
            <p className="text-lg font-bold text-muted-foreground">{fmt(arBuckets.arFuture.total)}</p>
            <p className="text-xs text-muted-foreground">{arBuckets.arFuture.entries.length} título(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Bank Accounts Detail ── */}
      {bankAccounts.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Posição de Caixa por Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Limite</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((ba) => (
                  <TableRow key={ba.id}>
                    <TableCell className="font-medium">{ba.nome}</TableCell>
                    <TableCell>{ba.banco ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs capitalize">{ba.tipo_conta}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(ba.saldo_atual ?? 0))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(ba.limite_credito ?? 0))}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(Number(ba.saldo_atual ?? 0) + Number(ba.limite_credito ?? 0))}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{fmt(bankTotals.saldoTotal)}</TableCell>
                  <TableCell className="text-right">{fmt(bankTotals.limiteTotal)}</TableCell>
                  <TableCell className="text-right">{fmt(bankTotals.disponibilidadeTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── AP KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Vencido" value={fmt(totalOverdue)} icon={<AlertTriangle size={20} />} subtitle={`${countOverdue} título(s)`} />
        <KPICard title="A Vencer (Saídas)" value={fmt(totalDue)} icon={<CalendarClock size={20} />} />
        <KPICard title="Total Pendente" value={fmt(totalOverdue + totalDue)} icon={<Clock size={20} />} />
      </div>

      {/* ── AP Aging buckets ── */}
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

      {/* ── Detail table ── */}
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
                {buckets.slice(0, 4).flatMap((b) => renderBucketRows(b))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
