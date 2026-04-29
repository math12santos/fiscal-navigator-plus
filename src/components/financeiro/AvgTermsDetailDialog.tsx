import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Info, TrendingDown, TrendingUp } from "lucide-react";
import type { AvgTermsResult } from "@/hooks/useFinanceiroAvgTerms";

interface AvgTermsDetailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "saida" | "entrada";
  result: AvgTermsResult & { windowDays: number };
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function AvgTermsDetailDialog({ open, onOpenChange, tipo, result }: AvgTermsDetailDialogProps) {
  const indicador = tipo === "saida" ? "PMP" : "PMR";
  const titulo = tipo === "saida" ? "Prazo Médio de Pagamento" : "Prazo Médio de Recebimento";
  const Icon = tipo === "saida" ? TrendingDown : TrendingUp;

  const maxBucket = Math.max(...result.buckets.map((b) => b.total), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {titulo} ({indicador}) — últimos {result.windowDays} dias
          </DialogTitle>
          <DialogDescription>
            Diferença média (ponderada pelo valor) entre o último dia do mês de competência
            e a data {tipo === "saida" ? "de pagamento" : "de recebimento"}.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border bg-primary/5 p-3 text-center">
            <div className="text-3xl font-bold tabular-nums text-primary">{result.pmp_pmr_days}</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Dias ({indicador})</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-center">
            <div className="text-2xl font-bold tabular-nums">{fmt(result.total_pago)}</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Volume {tipo === "saida" ? "pago" : "recebido"} ({result.count})
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-center">
            <div className="text-2xl font-bold tabular-nums">{result.cobertura_pct}%</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Cobertura competência</div>
          </div>
        </div>

        {/* Alerta de cobertura baixa */}
        {result.cobertura_pct < 80 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Cobertura abaixo do ideal ({result.cobertura_pct}%)
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                {result.count_sem_competencia} lançamento{result.count_sem_competencia > 1 ? "s" : ""} sem mês de competência —
                o {indicador} considera apenas lançamentos com competência. Para resultados precisos,
                preencha a competência nos lançamentos antigos.
              </p>
            </div>
          </div>
        )}

        {/* Distribuição por faixa */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Distribuição por faixa de prazo</h4>
          <div className="space-y-1.5">
            {result.buckets.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-xs w-20 text-muted-foreground">{b.label}</span>
                <div className="flex-1 h-5 bg-muted rounded relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/30 rounded"
                    style={{ width: `${(b.total / maxBucket) * 100}%` }}
                  />
                  <div className="relative flex items-center h-full px-2 text-[11px] tabular-nums">
                    <span className="font-medium">{fmt(b.total)}</span>
                    <span className="ml-2 text-muted-foreground">({b.count})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolução mensal */}
        {result.monthly.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Evolução mensal ({indicador} por mês de pagamento)</h4>
            <div className="grid grid-cols-6 gap-2">
              {result.monthly.map((m) => (
                <div key={m.month} className="rounded border p-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase">{m.month}</div>
                  <div className="text-lg font-bold tabular-nums">{Math.round(m.avg_days)}</div>
                  <div className="text-[9px] text-muted-foreground">dias</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top entidades */}
        {result.topEntities.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">
              Top {tipo === "saida" ? "fornecedores" : "clientes"} por prazo
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tipo === "saida" ? "Fornecedor" : "Cliente"}</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                  <TableHead className="text-right">Prazo médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.topEntities.map((e) => (
                  <TableRow key={e.entity_id ?? "—"}>
                    <TableCell className="text-xs">{e.entity_name}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(e.total_pago)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{e.count}</TableCell>
                    <TableCell className="text-xs text-right">
                      <Badge variant={e.avg_days > 60 ? "destructive" : e.avg_days > 30 ? "secondary" : "outline"}>
                        {Math.round(e.avg_days)} dias
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Sem competência */}
        {result.semCompetencia.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              Lançamentos sem competência (excluídos do cálculo)
            </h4>
            <div className="max-h-48 overflow-y-auto rounded border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data {tipo === "saida" ? "Pgto" : "Recebimento"}</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.semCompetencia.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs max-w-xs truncate">{s.descricao}</TableCell>
                      <TableCell className="text-xs">{s.data_realizada}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(s.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Edite cada lançamento e preencha o campo "Mês Competência" para incluí-los no cálculo.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
