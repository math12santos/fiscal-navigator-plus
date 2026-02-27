import { useState } from "react";
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
import { CheckCircle, Clock, Circle, Trash2, Loader2, Banknote } from "lucide-react";
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

  return (
    <>
      <div className="glass-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Previsto</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => {
              const isProjected = e.id.startsWith("proj-");
              const sc = statusConfig[e.status] ?? statusConfig.previsto;
              const Icon = sc.icon;
              const isPending = e.status === "previsto" || e.status === "confirmado";
              const isManual = e.source === "manual";

              return (
                <TableRow key={e.id} className={cn(isProjected && "opacity-80")}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(e.data_prevista), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-sm">{e.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {e.categoria ?? "—"}
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
