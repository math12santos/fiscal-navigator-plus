import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { CheckCircle, Clock, Circle, Trash2, Loader2, Banknote, ChevronRight, ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
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

// Categories that should be grouped into expandable rows
const GROUPABLE_CATEGORIES = ["Pessoal"];
const GROUPABLE_SOURCES = ["dp"];

interface GroupedRow {
  type: "group";
  key: string;
  label: string;
  entries: FinanceiroEntry[];
  totalPrevisto: number;
  totalRealizado: number;
  month: string;
  status: string;
  source: string;
}

interface SingleRow {
  type: "single";
  entry: FinanceiroEntry;
}

type DisplayRow = GroupedRow | SingleRow;

interface Props {
  entries: FinanceiroEntry[];
  tipo: "saida" | "entrada";
  onMarkAsPaid: (entry: { id: string; valor_realizado: number; data_realizada: string; isProjected: boolean }) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function FinanceiroTable({ entries, tipo, onMarkAsPaid, onDelete, isDeleting }: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payEntry, setPayEntry] = useState<FinanceiroEntry | null>(null);
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payValue, setPayValue] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build display rows: group eligible entries, keep the rest as singles
  const displayRows = useMemo<DisplayRow[]>(() => {
    const groups = new Map<string, FinanceiroEntry[]>();
    const singles: FinanceiroEntry[] = [];

    for (const e of entries) {
      const isGroupable =
        GROUPABLE_CATEGORIES.includes(e.categoria ?? "") ||
        GROUPABLE_SOURCES.includes(e.source);

      if (isGroupable) {
        const month = format(new Date(e.data_prevista), "yyyy-MM");
        const key = `${e.categoria ?? e.source}-${month}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      } else {
        singles.push(e);
      }
    }

    const rows: DisplayRow[] = [];

    // Convert groups with 2+ entries into GroupedRows; singles stay as-is
    const usedGroupKeys = new Set<string>();
    for (const [key, groupEntries] of groups) {
      if (groupEntries.length >= 2) {
        usedGroupKeys.add(key);
        const month = format(new Date(groupEntries[0].data_prevista), "MM/yyyy");
        const cat = groupEntries[0].categoria ?? "Pessoal";
        const totalPrevisto = groupEntries.reduce((s, e) => s + Number(e.valor_previsto), 0);
        const totalRealizado = groupEntries.reduce((s, e) => s + (e.valor_realizado != null ? Number(e.valor_realizado) : 0), 0);
        const allPaid = groupEntries.every((e) => e.status === "pago" || e.status === "recebido");
        const somePaid = groupEntries.some((e) => e.status === "pago" || e.status === "recebido");

        rows.push({
          type: "group",
          key,
          label: `${cat} — ${month}`,
          entries: groupEntries,
          totalPrevisto,
          totalRealizado,
          month,
          status: allPaid ? (tipo === "entrada" ? "recebido" : "pago") : somePaid ? "confirmado" : "previsto",
          source: groupEntries[0].source,
        });
      } else {
        // Single entry in group → treat as regular
        singles.push(...groupEntries);
      }
    }

    // Add singles
    for (const e of singles) {
      rows.push({ type: "single", entry: e });
    }

    // Sort by date
    rows.sort((a, b) => {
      const dateA = a.type === "group" ? a.entries[0].data_prevista : a.entry.data_prevista;
      const dateB = b.type === "group" ? b.entries[0].data_prevista : b.entry.data_prevista;
      return dateA.localeCompare(dateB);
    });

    return rows;
  }, [entries, tipo]);

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

  const renderEntryRow = (e: FinanceiroEntry, indent = false) => {
    const isProjected = e.id.startsWith("proj-");
    const sc = statusConfig[e.status] ?? statusConfig.previsto;
    const Icon = sc.icon;
    const isPending = e.status === "previsto" || e.status === "confirmado";
    const isManual = e.source === "manual";

    return (
      <TableRow key={e.id} className={cn(isProjected && "opacity-80", indent && "bg-muted/30")}>
        <TableCell className={cn("whitespace-nowrap text-sm", indent && "pl-10")}>
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
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => openPay(e)}
              >
                <Banknote size={14} />
                {actionLabel}
              </Button>
            )}
            {isManual && !isProjected && (
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setDeleteId(e.id)}
              >
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
            {displayRows.map((row) => {
              if (row.type === "single") {
                return renderEntryRow(row.entry);
              }

              // Group row
              const isExpanded = expandedGroups.has(row.key);
              const sc = statusConfig[row.status] ?? statusConfig.previsto;
              const Icon = sc.icon;

              return (
                <>
                  <TableRow
                    key={row.key}
                    className="cursor-pointer hover:bg-muted/50 font-medium"
                    onClick={() => toggleGroup(row.key)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        {row.month}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.label}
                        <Badge variant="secondary" className="text-xs font-normal">
                          {row.entries.length} itens
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.entries[0].categoria ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">{fmt(row.totalPrevisto)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      {row.totalRealizado > 0 ? fmt(row.totalRealizado) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={cn("flex items-center gap-1 text-xs", sc.class)}>
                        <Icon size={14} />
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{row.source}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  {isExpanded && row.entries.map((e) => renderEntryRow(e, true))}
                </>
              );
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
