import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calculator, Info, AlertTriangle } from "lucide-react";
import {
  buildTerminationBreakdown,
  breakdownFromPersistedValues,
  rebuildBreakdownFromRecord,
  type BreakdownLine,
} from "@/lib/terminationBreakdown";
import { TERM_TYPES, PJ_TERM_TYPES } from "./TerminationSimulatorDialog";

const ALL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  [...TERM_TYPES, ...PJ_TERM_TYPES].map((t) => [t.value, t.label]),
);

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termination: any | null;
  employee: any | null;
  fgtsPct?: number;
}

export default function TerminationDetailsDialog({
  open,
  onOpenChange,
  termination,
  employee,
  fgtsPct = 8,
}: Props) {
  const view = useMemo(() => {
    if (!termination) return null;

    // 1) Try to rebuild a live breakdown (with formulas) from current employee data.
    const live = employee
      ? rebuildBreakdownFromRecord(termination, employee, fgtsPct)
      : null;

    if (live) {
      const persistedTotal = Number(termination.total_rescisao || 0);
      const drift = Math.abs(persistedTotal - live.total) > 0.01;
      return { mode: "live" as const, breakdown: live, persistedTotal, drift };
    }

    // 2) Fallback: just show the persisted numbers (no formulas).
    const persisted = breakdownFromPersistedValues(termination);
    return {
      mode: "persisted" as const,
      breakdown: persisted,
      persistedTotal: persisted.total,
      drift: false,
    };
  }, [termination, employee, fgtsPct]);

  if (!termination) return null;

  const regime = view?.breakdown.contract_type ?? termination.contract_type ?? "CLT";
  const typeLabel = ALL_TYPE_LABELS[termination.type] ?? termination.type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator size={18} className="text-primary" />
            Memória de cálculo da rescisão
          </DialogTitle>
          <DialogDescription>
            {employee?.name ?? "Colaborador"} · {format(new Date(termination.termination_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4">
            {/* Cabeçalho com snapshot */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Field label="Regime">
                <Badge variant="secondary">{regime}</Badge>
              </Field>
              <Field label="Tipo">
                <Badge variant="outline">{typeLabel}</Badge>
              </Field>
              <Field label="Status">
                <Badge variant={termination.status === "simulacao" ? "secondary" : "default"}>
                  {termination.status}
                </Badge>
              </Field>
              <Field label="Data da rescisão">
                {format(new Date(termination.termination_date), "dd/MM/yyyy")}
              </Field>
            </div>

            {view?.mode === "live" && view.breakdown && "base" in view.breakdown && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/40 rounded-lg p-3">
                <Field label="Salário base">{fmtBRL(view.breakdown.base.salary)}</Field>
                <Field label="Tempo de casa">
                  {view.breakdown.base.fullYears} ano(s) ·{" "}
                  {view.breakdown.base.monthsWorked} mês(es)
                </Field>
                <Field label="FGTS configurado">{view.breakdown.base.fgtsPct}%</Field>
                <Field label="Mês no ano">{view.breakdown.base.monthInYear}/12</Field>
              </div>
            )}

            {view?.mode === "persisted" && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Não foi possível recalcular a fórmula (salário ou data de admissão indisponíveis no
                  cadastro atual). Mostrando apenas os <strong>valores persistidos</strong> da rescisão.
                </AlertDescription>
              </Alert>
            )}

            {view?.drift && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  O total recalculado ({fmtBRL(view.breakdown.total)}) diverge do valor registrado
                  ({fmtBRL(view.persistedTotal)}). O salário ou a data de admissão pode ter mudado
                  desde o cálculo original. Os valores oficiais são os <strong>persistidos</strong>.
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Memória de cálculo */}
            <div className="space-y-2">
              {view?.breakdown.lines.map((line) => (
                <BreakdownLineRow key={line.key} line={line} />
              ))}
            </div>

            <Separator />

            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Total da rescisão</p>
                <p className="text-xs text-muted-foreground/80">
                  Valor persistido (oficial)
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-primary">
                {fmtBRL(view?.persistedTotal ?? 0)}
              </p>
            </div>

            {termination.notes && (
              <div className="text-xs">
                <p className="text-muted-foreground mb-1">Observações</p>
                <p className="bg-muted/40 rounded p-3 whitespace-pre-wrap">{termination.notes}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
      <div className="mt-0.5 text-foreground">{children}</div>
    </div>
  );
}

function BreakdownLineRow({ line }: { line: BreakdownLine }) {
  const isZero = line.value === 0;
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        isZero ? "border-border/60 bg-muted/20" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${isZero ? "text-muted-foreground" : "text-foreground"}`}>
            {line.label}
          </p>
          {line.basis && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{line.basis}</p>
          )}
          {!isZero && line.formula !== "—" && (
            <p className="text-[11px] font-mono text-muted-foreground mt-1.5">
              <span className="text-primary">ƒ</span> {line.formula}
            </p>
          )}
          {isZero && line.zeroReason && (
            <p className="text-[11px] text-muted-foreground italic mt-1">{line.zeroReason}</p>
          )}
        </div>
        <p
          className={`shrink-0 font-mono text-sm tabular-nums ${
            isZero ? "text-muted-foreground" : "font-semibold text-foreground"
          }`}
        >
          {fmtBRL(line.value)}
        </p>
      </div>
    </div>
  );
}
