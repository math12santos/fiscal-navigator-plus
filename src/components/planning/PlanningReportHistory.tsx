/**
 * Drawer com o histórico das últimas exportações de PDF do Planejamento.
 * Permite re-baixar (regerar com os mesmos parâmetros) ou descartar entradas.
 *
 * O PDF é regerado usando o estado ATUAL do banco — os parâmetros salvos
 * (cenário, versão, horizonte, filtros) servem para reproduzir o recorte.
 */
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, FileDown, Trash2, Loader2, AlertTriangle, Building2, Wallet, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  usePlanningReportExports,
  type PlanningEmptyReason,
  type PlanningExportFilterLabels,
} from "@/hooks/usePlanningReportExports";
import { usePlanningPdfReport } from "@/hooks/usePlanningPdfReport";
import { EMPTY_PLANNING_FILTERS, withFilterDefaults, type PlanningFilters } from "@/lib/planningFilters";

const EMPTY_REASON_LABEL: Record<PlanningEmptyReason, string> = {
  no_period_data: "Sem lançamentos no período",
  filters_excluded_all: "Filtros eliminaram todos os dados",
  no_budget_version: "Sem versão orçamentária ativa",
  other: "Recorte vazio",
};

/**
 * Botão "Re-baixar" — instancia o hook de PDF com os parâmetros salvos
 * e dispara a geração assim que ficar pronto.
 */
function RedownloadRow({
  startDate, endDate, budgetVersionId, filters = EMPTY_PLANNING_FILTERS, label,
}: {
  startDate: Date; endDate: Date; budgetVersionId: string | null;
  filters?: PlanningFilters; label: string;
}) {
  const { generatePdf, isReady } = usePlanningPdfReport({
    startDate, endDate, budgetVersionId, filters,
  });
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!isReady || busy) return;
    try {
      setBusy(true);
      await new Promise((r) => setTimeout(r, 0));
      generatePdf();
      toast.success(`PDF regerado · ${label}`);
    } catch (e: any) {
      toast.error("Falha ao regerar PDF", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handle}
      disabled={!isReady || busy}
      className="gap-1.5"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
      Re-baixar
    </Button>
  );
}

/**
 * Renderiza o snapshot de filtros nomeados salvo na exportação. Cai
 * para o resumo textual antigo (`filters_summary`) quando o registro
 * é anterior à coluna `filter_labels` (compatibilidade com histórico
 * existente).
 */
function FilterLabelsBlock({
  labels,
  fallbackSummary,
}: {
  labels: PlanningExportFilterLabels | null | undefined;
  fallbackSummary: string | null;
}) {
  const subsidiary = labels?.subsidiary ?? null;
  const banks = labels?.bankAccounts ?? [];
  const ccs = labels?.costCenters ?? [];
  const hasNamed = !!subsidiary || banks.length > 0 || ccs.length > 0;

  if (!hasNamed) {
    if (fallbackSummary && fallbackSummary !== "Nenhum") {
      return (
        <p className="text-[11px] text-muted-foreground">
          Filtros: {fallbackSummary}
        </p>
      );
    }
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Sem filtros aplicados
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        Filtros aplicados
      </p>
      <div className="flex flex-wrap gap-1">
        {subsidiary && (
          <Badge variant="secondary" className="font-normal gap-1 text-[11px]">
            <Building2 className="h-3 w-3" />
            {subsidiary}
          </Badge>
        )}
        {banks.map((b) => (
          <Badge key={`b-${b}`} variant="secondary" className="font-normal gap-1 text-[11px]">
            <Wallet className="h-3 w-3" />
            {b}
          </Badge>
        ))}
        {ccs.map((c) => (
          <Badge key={`c-${c}`} variant="secondary" className="font-normal gap-1 text-[11px]">
            <Layers className="h-3 w-3" />
            {c}
          </Badge>
        ))}
      </div>
    </div>
  );
}
export default function PlanningReportHistory() {
  const { list, remove } = usePlanningReportExports();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => list.data ?? [], [list.data]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" title="Histórico de exportações">
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Histórico</span>
          {items.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
              {items.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Histórico de Relatórios</SheetTitle>
          <SheetDescription>
            Suas últimas exportações. O PDF é regerado a partir dos dados atuais.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhuma exportação registrada ainda.
              <br />
              Use <span className="font-medium">Exportar PDF</span> para começar.
            </div>
          ) : (
            <ul className="space-y-3 pb-6">
              {items.map((item) => {
                const start = new Date(item.start_date + "T00:00:00");
                const end = new Date(item.end_date + "T00:00:00");
                const created = new Date(item.created_at);
                const horizonLabel = `${format(start, "MMM/yy", { locale: ptBR })} — ${format(end, "MMM/yy", { locale: ptBR })}`;
                return (
                  <li
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {format(created, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">{horizonLabel}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          try {
                            await remove.mutateAsync(item.id);
                            toast.success("Registro removido");
                          } catch (e: any) {
                            toast.error("Falha ao remover", { description: e?.message });
                          }
                        }}
                        title="Remover do histórico"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <Badge variant="outline" className="font-normal">
                        Cenário: {item.scenario_name ?? "Base"}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        Versão: {item.budget_version_name ?? "—"}
                      </Badge>
                      {item.had_data === false && (
                        <Badge
                          variant="outline"
                          className="font-normal border-warning/40 text-warning gap-1"
                          title="Esta exportação foi gerada sem dados"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {EMPTY_REASON_LABEL[item.empty_reason ?? "other"]}
                        </Badge>
                      )}
                    </div>

                    <FilterLabelsBlock labels={item.filter_labels} fallbackSummary={item.filters_summary} />

                    <div className="flex justify-end pt-1">
                      <RedownloadRow
                        startDate={start}
                        endDate={end}
                        budgetVersionId={item.budget_version_id}
                        filters={withFilterDefaults(item.filters)}
                        label={format(created, "dd/MM HH:mm", { locale: ptBR })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
