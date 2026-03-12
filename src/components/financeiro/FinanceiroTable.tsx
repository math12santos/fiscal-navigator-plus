import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle, Clock, Circle, Trash2, Banknote, ChevronRight, ChevronDown, Layers, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGroupingRules } from "@/hooks/useGroupingRules";
import { useGroupingMacrogroups } from "@/hooks/useGroupingMacrogroups";
import { buildHierarchy } from "@/lib/groupingHierarchy";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const statusConfig: Record<string, { icon: typeof Circle; class: string; label: string }> = {
  previsto: { icon: Clock, class: "text-muted-foreground", label: "Previsto" },
  confirmado: { icon: CheckCircle, class: "text-warning", label: "Confirmado" },
  pago: { icon: CheckCircle, class: "text-success", label: "Pago" },
  recebido: { icon: CheckCircle, class: "text-success", label: "Recebido" },
  cancelado: { icon: Circle, class: "text-destructive", label: "Cancelado" },
};

interface Props {
  entries: FinanceiroEntry[];
  tipo: "saida" | "entrada";
  onMarkAsPaid: (entry: { id: string; valor_realizado: number; data_realizada: string; isProjected: boolean }) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function FinanceiroTable({ entries, tipo, onMarkAsPaid, onDelete, isDeleting }: Props) {
  const { getMatchingRule, getGroupLabel, getMinItems } = useGroupingRules();
  const { macrogroups, groups } = useGroupingMacrogroups();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payEntry, setPayEntry] = useState<FinanceiroEntry | null>(null);
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payValue, setPayValue] = useState(0);
  const [expandedMacrogroups, setExpandedMacrogroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group entries by month first, then build hierarchy within each month
  const monthlyHierarchy = useMemo(() => {
    // Group by month
    const byMonth = new Map<string, FinanceiroEntry[]>();
    for (const e of entries) {
      const month = format(new Date(e.data_prevista), "yyyy-MM");
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(e);
    }

    const result: { month: string; monthLabel: string; hierarchy: ReturnType<typeof buildHierarchy>; singles: FinanceiroEntry[] }[] = [];

    for (const [month, monthEntries] of byMonth) {
      const monthLabel = format(new Date(month + "-01"), "MM/yyyy");

      // Build hierarchy for groupable entries within this month
      const hierarchy = buildHierarchy(
        monthEntries, getMatchingRule, getGroupLabel, groups, macrogroups
      );

      // Filter: macrogroups with too few items become singles
      const singles: FinanceiroEntry[] = [];
      const filteredHierarchy = hierarchy.filter((mgBucket) => {
        const minItems = mgBucket.entries.length > 0 ? getMinItems(mgBucket.entries[0]) : 2;
        if (mgBucket.entries.length < minItems) {
          singles.push(...mgBucket.entries);
          return false;
        }
        return true;
      });

      result.push({ month, monthLabel, hierarchy: filteredHierarchy, singles });
    }

    result.sort((a, b) => a.month.localeCompare(b.month));
    return result;
  }, [entries, macrogroups, groups, getMatchingRule, getGroupLabel, getMinItems]);

  const openPay = (e: FinanceiroEntry) => {
    setPayEntry(e);
    setPayValue(Number(e.valor_previsto));
    setPayDate(format(new Date(), "yyyy-MM-dd"));
  };

  const confirmPay = () => {
    if (!payEntry) return;
    const isProjected = payEntry.id.startsWith("proj-");
    onMarkAsPaid({ id: payEntry.id, valor_realizado: payValue, data_realizada: payDate, isProjected });
    setPayEntry(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const actionLabel = tipo === "entrada" ? "Receber" : "Pagar";

  if (entries.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        <p>Nenhum lançamento encontrado.</p>
      </div>
    );
  }

  const renderEntryRow = (e: FinanceiroEntry, indent = 0) => {
    const isProjected = e.id.startsWith("proj-");
    const sc = statusConfig[e.status] ?? statusConfig.previsto;
    const Icon = sc.icon;
    const isPending = e.status === "previsto" || e.status === "confirmado";
    const isManual = e.source === "manual";

    return (
      <TableRow key={e.id} className={cn(isProjected && "opacity-80", indent > 0 && "bg-muted/30", indent > 1 && "bg-muted/15")}>
        <TableCell className={cn("whitespace-nowrap text-sm", indent === 1 && "pl-10", indent === 2 && "pl-16")}>
          {format(new Date((e as any).data_vencimento || e.data_prevista), "dd/MM/yyyy")}
        </TableCell>
        <TableCell className="text-sm max-w-[200px] truncate">{e.descricao}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {(e as any).documento ?? "—"}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs capitalize">
            {(e as any).tipo_despesa ?? e.categoria ?? "—"}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono text-sm">{fmt(Number(e.valor_previsto))}</TableCell>
        <TableCell className="text-right font-mono text-sm">
          {e.valor_realizado != null ? fmt(Number(e.valor_realizado)) : "—"}
        </TableCell>
        <TableCell>
          <span className={cn("flex items-center gap-1 text-xs", sc.class)}>
            <Icon size={14} />
            {sc.label}
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground capitalize">{e.source}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {isPending && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openPay(e)}>
                <Banknote size={14} />
                {actionLabel}
              </Button>
            )}
            {isManual && !isProjected && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(e.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <>
      <div className="glass-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Previsto</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyHierarchy.flatMap(({ month, monthLabel, hierarchy, singles }) => {
              const rows: React.ReactNode[] = [];

              for (const mgBucket of hierarchy) {
                const mgKey = `ft-${month}-mg-${mgBucket.info.macrogroupId}`;
                const isMgExpanded = expandedMacrogroups.has(mgKey);
                const mgGroups = Array.from(mgBucket.groups.values());
                const hasSingleGroup = mgGroups.length === 1;

                const totalPrevisto = mgBucket.entries.reduce((s, e) => s + Number(e.valor_previsto), 0);
                const totalRealizado = mgBucket.entries.reduce((s, e) => s + (e.valor_realizado != null ? Number(e.valor_realizado) : 0), 0);
                const allPaid = mgBucket.entries.every((e: any) => e.status === "pago" || e.status === "recebido");
                const somePaid = mgBucket.entries.some((e: any) => e.status === "pago" || e.status === "recebido");
                const status = allPaid ? (tipo === "entrada" ? "recebido" : "pago") : somePaid ? "confirmado" : "previsto";
                const sc = statusConfig[status] ?? statusConfig.previsto;
                const StatusIcon = sc.icon;

                // Level 0 — Macrogroup header
                rows.push(
                  <TableRow
                    key={mgKey}
                    className="cursor-pointer hover:bg-muted/50 font-semibold"
                    onClick={() => toggle(setExpandedMacrogroups, mgKey)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1.5">
                        {isMgExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        {monthLabel}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
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
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-mono text-sm font-bold">{fmt(totalPrevisto)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      {totalRealizado > 0 ? fmt(totalRealizado) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={cn("flex items-center gap-1 text-xs", sc.class)}>
                        <StatusIcon size={14} />
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {mgBucket.entries[0]?.source ?? "—"}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                );

                if (!isMgExpanded) continue;

                // If single group, skip group level
                if (hasSingleGroup) {
                  for (const entry of mgGroups[0].entries) {
                    rows.push(renderEntryRow(entry, 1));
                  }
                  continue;
                }

                // Level 1 — Group headers
                for (const grpBucket of mgGroups) {
                  const grpKey = `${mgKey}__${grpBucket.info.groupId}`;
                  const isGrpExpanded = expandedGroups.has(grpKey);
                  const grpTotalPrevisto = grpBucket.entries.reduce((s: number, e: any) => s + Number(e.valor_previsto), 0);
                  const grpTotalRealizado = grpBucket.entries.reduce((s: number, e: any) => s + (e.valor_realizado != null ? Number(e.valor_realizado) : 0), 0);

                  rows.push(
                    <TableRow
                      key={grpKey}
                      className="cursor-pointer hover:bg-muted/40 bg-muted/30"
                      onClick={(ev) => { ev.stopPropagation(); toggle(setExpandedGroups, grpKey); }}
                    >
                      <TableCell className="pl-8 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1.5">
                          {isGrpExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          {grpBucket.info.groupName}
                          <Badge variant="secondary" className="text-xs font-normal">
                            {grpBucket.entries.length}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">—</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono text-sm font-semibold">{fmt(grpTotalPrevisto)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {grpTotalRealizado > 0 ? fmt(grpTotalRealizado) : "—"}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  );

                  // Level 2 — Individual entries
                  if (isGrpExpanded) {
                    for (const entry of grpBucket.entries) {
                      rows.push(renderEntryRow(entry, 2));
                    }
                  }
                }
              }

              // Singles (entries below minItems threshold)
              for (const e of singles) {
                rows.push(renderEntryRow(e));
              }

              return rows;
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pay/Receive Dialog */}
      <Dialog open={!!payEntry} onOpenChange={() => setPayEntry(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tipo === "entrada" ? "Confirmar Recebimento" : "Confirmar Pagamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor Realizado (R$)</Label>
              <Input type="number" value={payValue} onChange={(e) => setPayValue(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>{tipo === "entrada" ? "Data Recebimento" : "Data Pagamento"}</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayEntry(null)}>Cancelar</Button>
            <Button onClick={confirmPay}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
