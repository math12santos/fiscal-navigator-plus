import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Clock, Circle, Info, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CashFlowEntry } from "@/hooks/useCashFlow";
import {
  getEntryCompetency,
  formatCompetencyShort,
  getCompetencyShift,
  describeCompetencyShift,
} from "@/lib/cashflowDisplay";

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
        <TooltipProvider delayDuration={150}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Competência</TableHead>
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

                const comp = getEntryCompetency(e);
                const pay = (() => {
                  try { return parseISO(e.data_prevista); } catch { return null; }
                })();
                const shift = getCompetencyShift(e);
                const shiftDesc = describeCompetencyShift(shift, comp, pay);

                const hasNotes = !!(e.notes && e.notes.trim().length > 0);

                return (
                  <TableRow key={e.id} className={cn(isProjected && "opacity-80")}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(e.data_prevista), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">
                          {formatCompetencyShort(comp)}
                        </span>
                        {shiftDesc && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 px-1.5 text-[10px] gap-1 cursor-help",
                                  shift === "anticipated"
                                    ? "border-primary/40 text-primary"
                                    : "border-warning/40 text-warning",
                                )}
                              >
                                <ArrowLeftRight className="h-2.5 w-2.5" />
                                {shift === "anticipated" ? "Antecipado" : "Postergado"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                              {shiftDesc}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1.5">
                        <span className="flex-1">{e.descricao}</span>
                        {hasNotes && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Ver motivo / detalhes do lançamento"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed whitespace-pre-line">
                              {e.notes}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
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
        </TooltipProvider>
      </div>
    </div>
  );
}
