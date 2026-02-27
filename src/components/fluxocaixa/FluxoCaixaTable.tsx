import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { CheckCircle, Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CashFlowEntry } from "@/hooks/useCashFlow";

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
  entries: CashFlowEntry[];
}

export function FluxoCaixaTable({ entries }: Props) {
  return (
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
  );
}
