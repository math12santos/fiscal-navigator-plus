import { useMemo, useState } from "react";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useContracts } from "@/hooks/useContracts";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, X, FileSignature, RotateCcw } from "lucide-react";
import {
  buildFixedExpenseSuggestions,
  type FixedExpenseSuggestion,
} from "@/lib/fixedExpensesDetection";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  /** First day of the period currently visible. */
  rangeFrom: Date;
}

const ignoreKey = (orgId: string | null | undefined) =>
  `cashflow:fixed-suggestions:ignored:${orgId ?? "anon"}`;

const loadIgnored = (orgId: string | null | undefined): Set<string> => {
  try {
    const raw = localStorage.getItem(ignoreKey(orgId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const persistIgnored = (orgId: string | null | undefined, set: Set<string>) => {
  try {
    localStorage.setItem(ignoreKey(orgId), JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
};

export function FixedExpensesSuggestionsCard({ rangeFrom }: Props) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const { contracts } = useContracts();

  const targetMonth = startOfMonth(rangeFrom);
  const periodStart = targetMonth;
  const periodEnd = addMonths(targetMonth, 1);

  // History: previous 3 months ending right before the target month.
  const historyFrom = subMonths(targetMonth, 3);
  const historyTo = subMonths(targetMonth, 1);

  const { entries: periodEntries } = useCashFlow(periodStart, periodEnd);
  const { entries: historyEntries } = useCashFlow(historyFrom, historyTo);
  const { create } = useCashFlow();

  const [ignored, setIgnored] = useState<Set<string>>(() => loadIgnored(orgId));
  const [adding, setAdding] = useState<string | null>(null);

  const suggestions = useMemo<FixedExpenseSuggestion[]>(
    () =>
      buildFixedExpenseSuggestions({
        contracts,
        historyEntries,
        periodEntries,
        targetMonth,
      }).filter((s) => !ignored.has(s.key)),
    [contracts, historyEntries, periodEntries, targetMonth, ignored],
  );

  const handleIgnore = (key: string) => {
    const next = new Set(ignored);
    next.add(key);
    setIgnored(next);
    persistIgnored(orgId, next);
  };

  const handleResetIgnored = () => {
    setIgnored(new Set());
    persistIgnored(orgId, new Set());
  };

  const handleAdd = async (s: FixedExpenseSuggestion) => {
    setAdding(s.key);
    try {
      await create.mutateAsync(s.payload as any);
      handleIgnore(s.key);
    } finally {
      setAdding(null);
    }
  };

  if (suggestions.length === 0 && ignored.size === 0) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Contas fixas sugeridas para {format(targetMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Baseadas em contratos recorrentes ativos e padrões dos últimos 3 meses. Adicione ao orçamento previsto.
            </p>
          </div>
        </div>
        {ignored.size > 0 && (
          <Button size="sm" variant="ghost" onClick={handleResetIgnored} className="h-7 text-xs">
            <RotateCcw className="h-3 w-3 mr-1" /> Restaurar {ignored.size} ignorada{ignored.size > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhuma nova sugestão. Tudo que se repete já está projetado.
        </p>
      ) : (
        <div className="space-y-2">
          {suggestions.slice(0, 12).map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2"
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wide shrink-0"
                  title={s.origin === "contrato" ? "Contrato recorrente" : "Padrão histórico"}
                >
                  {s.origin === "contrato" ? (
                    <>
                      <FileSignature className="h-3 w-3 mr-1" /> Contrato
                    </>
                  ) : (
                    "Padrão"
                  )}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.motivo} · venc. dia {s.diaSugerido}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={
                    s.tipo === "entrada"
                      ? "text-sm font-mono font-semibold text-success"
                      : "text-sm font-mono font-semibold text-destructive"
                  }
                >
                  {s.tipo === "entrada" ? "+" : "−"}
                  {fmt(s.valorMedio)}
                </p>
                <p className="text-[10px] text-muted-foreground">média mensal</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={() => handleAdd(s)}
                  disabled={adding === s.key}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleIgnore(s.key)}
                  title="Ignorar"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
