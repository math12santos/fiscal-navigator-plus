import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { addMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarIcon, Settings, Sparkles, FileDown, Loader2, Filter, X, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import PlanningCockpit, { PLANNING_NAV_EVENT } from "@/components/planning/PlanningCockpit";
import PlanningBudget from "@/components/planning/PlanningBudget";
import PlanningScenariosRisk from "@/components/planning/PlanningScenariosRisk";
import PlanningOperational from "@/components/planning/PlanningOperational";
import PlanningSettingsDialog from "@/components/planning/PlanningSettingsDialog";
import { PlanningScenarioProvider, usePlanningScenarioContext } from "@/contexts/PlanningScenarioContext";
import { usePlanningPdfReport } from "@/hooks/usePlanningPdfReport";
import { toast } from "sonner";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useHolding } from "@/contexts/HoldingContext";
import { Badge } from "@/components/ui/badge";
import {
  PlanningFilters, EMPTY_PLANNING_FILTERS, hasAnyFilter, sanitizeFilters, withFilterDefaults,
} from "@/lib/planningFilters";
import PlanningReportHistory from "@/components/planning/PlanningReportHistory";
import { usePlanningReportExports } from "@/hooks/usePlanningReportExports";

function ScenarioPicker() {
  const { scenarios, activeScenarioId, setActiveScenarioId, activeScenario } = usePlanningScenarioContext();
  if (scenarios.length === 0) return null;
  const variant =
    activeScenario?.type === "otimista" ? "text-success"
    : activeScenario?.type === "stress" ? "text-destructive"
    : activeScenario?.type === "conservador" ? "text-warning"
    : "text-primary";
  return (
    <div className="flex items-center gap-1.5">
      <Sparkles className={cn("h-3.5 w-3.5", variant)} />
      <Select value={activeScenarioId ?? ""} onValueChange={(v) => setActiveScenarioId(v || null)}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Cenário" />
        </SelectTrigger>
        <SelectContent>
          {scenarios.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="capitalize">{s.name}</span>
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {s.variacao_receita > 0 ? "+" : ""}{s.variacao_receita}% rec · {s.variacao_custos > 0 ? "+" : ""}{s.variacao_custos}% custo
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Lista compacta de checkbox com campo de busca, usada para multi-seleção
 * de Conta Bancária e Centro de Custo. Sem dependências novas.
 */
function MultiSelectList({
  options,
  selectedIds,
  onChange,
  placeholder,
  emptyLabel,
}: {
  options: { id: string; label: string; sub?: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sub ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="rounded-md border border-border">
      <div className="relative border-b border-border">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-7 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs"
        />
      </div>
      <ScrollArea className="h-40">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-3 py-4 text-center">
            {emptyLabel}
          </p>
        ) : (
          <ul className="py-1">
            {filtered.map((o) => {
              const checked = selectedIds.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent text-left"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(o.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5"
                    />
                    <span className="flex-1 truncate">
                      {o.label}
                      {o.sub && (
                        <span className="text-muted-foreground"> · {o.sub}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

/**
 * Pop-over com filtros: unidade (single), conta bancária (multi) e centro
 * de custo (multi). O contador no botão soma dimensões com filtro ativo
 * (não itens), pra manter o sinal visual estável.
 */
function FilterPopover({
  filters, setFilters, hasActiveFiltersWithoutData,
}: {
  filters: PlanningFilters;
  setFilters: (f: PlanningFilters) => void;
  hasActiveFiltersWithoutData: boolean;
}) {
  const { costCenters } = useCostCenters();
  const { allBankAccounts } = useBankAccounts();
  const { isHolding, subsidiaryOrgs } = useHolding();
  const ALL = "__all__";
  const activeCount =
    (filters.subsidiaryOrgId ? 1 : 0) +
    (filters.bankAccountIds.length > 0 ? 1 : 0) +
    (filters.costCenterIds.length > 0 ? 1 : 0);

  const bankOptions = useMemo(
    () => allBankAccounts.map((b) => ({
      id: b.id,
      label: b.nome,
      sub: b.banco ?? undefined,
    })),
    [allBankAccounts],
  );

  const ccOptions = useMemo(
    () => costCenters
      .filter((c) => c.active)
      .map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` })),
    [costCenters],
  );

  const bankSummary = filters.bankAccountIds.length === 0
    ? "Todas"
    : `${filters.bankAccountIds.length} selecionada${filters.bankAccountIds.length > 1 ? "s" : ""}`;
  const ccSummary = filters.costCenterIds.length === 0
    ? "Todos"
    : `${filters.costCenterIds.length} selecionado${filters.costCenterIds.length > 1 ? "s" : ""}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Filtrar visões</p>
          {hasAnyFilter(filters) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setFilters(EMPTY_PLANNING_FILTERS)}
            >
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>

        {isHolding && subsidiaryOrgs.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Unidade</label>
            <Select
              value={filters.subsidiaryOrgId ?? ALL}
              onValueChange={(v) =>
                setFilters({ ...filters, subsidiaryOrgId: v === ALL ? null : v })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as unidades</SelectItem>
                {subsidiaryOrgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Contas bancárias</label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{bankSummary}</span>
              {filters.bankAccountIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, bankAccountIds: [] })}
                  className="text-[10px] text-primary hover:underline"
                >
                  limpar
                </button>
              )}
            </div>
          </div>
          <MultiSelectList
            options={bankOptions}
            selectedIds={filters.bankAccountIds}
            onChange={(ids) => setFilters({ ...filters, bankAccountIds: ids })}
            placeholder="Buscar conta…"
            emptyLabel="Nenhuma conta encontrada"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Centros de custo</label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{ccSummary}</span>
              {filters.costCenterIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, costCenterIds: [] })}
                  className="text-[10px] text-primary hover:underline"
                >
                  limpar
                </button>
              )}
            </div>
          </div>
          <MultiSelectList
            options={ccOptions}
            selectedIds={filters.costCenterIds}
            onChange={(ids) => setFilters({ ...filters, costCenterIds: ids })}
            placeholder="Buscar centro de custo…"
            emptyLabel="Nenhum centro de custo encontrado"
          />
        </div>

        {hasActiveFiltersWithoutData && (
          <div className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-warning-foreground leading-tight">
              Recorte atual sem dados no período. Ajuste os filtros ou o horizonte.
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
          Filtros refletem em Cockpit, Plan×Real×Projetado e no PDF exportado.
        </p>
      </PopoverContent>
    </Popover>
  );
}

interface ExportPdfButtonProps {
  startDate: Date;
  endDate: Date;
  budgetVersionId: string | null;
  filters: PlanningFilters;
  onHasFilteredDataChange?: (v: boolean) => void;
  /** Quando true, ainda estamos carregando listas de referência usadas
   *  para validar filtros (contas, CCs, subsidiárias). Bloqueia exportar
   *  para evitar mensagens incorretas de "filtros inconsistentes". */
  refsLoading?: boolean;
  /** Inconsistências detectadas no momento do clique: filtros do URL que
   *  não existem mais nas listas atuais. Permite mensagem precisa antes
   *  de gastar tempo gerando um PDF vazio. */
  invalidFilters?: { dimension: string; count: number }[];
  /** Resumo legível dos filtros aplicados — usado para enriquecer o
   *  diálogo de "sem dados" e ajudar o usuário a entender o recorte. */
  filtersDescription?: string[];
  /** Sanitiza in-place removendo apenas filtros inválidos (ação sugerida
   *  no toast de "filtros inconsistentes"). */
  onClearInvalidFilters?: () => void;
  /** Limpa todos os filtros (ação sugerida no diálogo "zero dados"). */
  onClearAllFilters?: () => void;
}

function ExportPdfButton({
  startDate, endDate, budgetVersionId, filters,
  onHasFilteredDataChange,
  refsLoading = false,
  invalidFilters = [],
  filtersDescription = [],
  onClearInvalidFilters,
  onClearAllFilters,
}: ExportPdfButtonProps) {
  const { generatePdf, isReady, hasFilteredData } = usePlanningPdfReport({ startDate, endDate, budgetVersionId, filters });
  const { record } = usePlanningReportExports();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // ID do toast de "carregando referências" para podermos atualizá-lo
  // assim que as listas terminarem de carregar (UX contínua, sem clique extra).
  const loadingToastIdRef = useRef<string | number | null>(null);
  // Marca quando o usuário clicou enquanto as referências ainda carregavam,
  // para podermos disparar o export automaticamente assim que estiverem prontas.
  const pendingExportRef = useRef(false);

  // Repassa o sinal "tem dados após filtro" para o pai poder mostrar a nota
  // no FilterPopover. Single source of truth para evitar divergir do PDF.
  useEffect(() => {
    onHasFilteredDataChange?.(hasFilteredData);
  }, [hasFilteredData, onHasFilteredDataChange]);

  const runExport = useCallback(async () => {
    if (!isReady || busy) return;
    try {
      setBusy(true);
      await new Promise((r) => setTimeout(r, 0));
      const meta = generatePdf();
      toast.success("PDF gerado com sucesso");

      // Registra no histórico (best-effort — uma falha aqui não anula o PDF).
      if (meta) {
        record.mutate(
          {
            startDate, endDate, filters,
            scenarioId: meta.scenarioId,
            scenarioName: meta.scenarioName,
            budgetVersionId: meta.budgetVersionId,
            budgetVersionName: meta.budgetVersionName,
            filtersSummary: meta.filtersSummary,
            filterLabels: meta.filterLabels,
            hadData: meta.hadData,
            emptyReason: meta.emptyReason,
          },
          {
            onError: (e: any) => {
              if (import.meta.env.DEV) {
                console.warn("Falha ao registrar exportação no histórico:", e?.message);
              }
            },
          },
        );
      }
    } catch (e: any) {
      toast.error("Falha ao gerar PDF", {
        description: e?.message ?? "Erro inesperado ao montar o relatório.",
        action: {
          label: "Tentar novamente",
          onClick: () => void runExport(),
        },
      });
    } finally {
      setBusy(false);
    }
  }, [isReady, busy, generatePdf, record, startDate, endDate, filters]);

  const handleClick = useCallback(() => {
    // 1) Ainda carregando referências → não dá pra validar nem garantir
    //    consistência. Mostramos toast de progresso e marcamos
    //    `pendingExportRef` para disparar automaticamente quando terminar.
    if (refsLoading) {
      pendingExportRef.current = true;
      const id = toast.loading("Sincronizando filtros…", {
        description:
          "Carregando contas, centros de custo e unidades para validar o recorte. O PDF será gerado automaticamente em seguida.",
        action: {
          label: "Cancelar",
          onClick: () => {
            pendingExportRef.current = false;
            if (loadingToastIdRef.current !== null) {
              toast.dismiss(loadingToastIdRef.current);
              loadingToastIdRef.current = null;
            }
          },
        },
      });
      loadingToastIdRef.current = id;
      return;
    }

    // 2) Inconsistências detectadas: filtros referenciam itens que não
    //    existem mais. Oferecemos ação direta para limpar só os inválidos.
    if (invalidFilters.length > 0) {
      const total = invalidFilters.reduce((s, r) => s + r.count, 0);
      const dims = invalidFilters.map((r) => `${r.count} em ${r.dimension}`).join(", ");
      toast.warning("Filtros inconsistentes detectados", {
        description: `${total} filtro(s) apontam para itens que não existem mais nesta organização (${dims}). Limpe os inválidos para continuar com o recorte restante.`,
        duration: 10000,
        action: onClearInvalidFilters
          ? {
              label: "Limpar inválidos",
              onClick: () => {
                onClearInvalidFilters();
                toast.success("Filtros inválidos removidos", {
                  description: "Recorte ajustado — clique em Exportar PDF novamente para gerar o relatório.",
                });
              },
            }
          : undefined,
      });
      return;
    }

    // 3) Filtros válidos mas zero dados no horizonte → diálogo com opções
    //    claras: revisar, limpar tudo ou exportar PDF vazio.
    if (hasAnyFilter(filters) && !hasFilteredData) {
      setConfirmOpen(true);
      return;
    }

    void runExport();
  }, [refsLoading, invalidFilters, filters, hasFilteredData, onClearInvalidFilters, runExport]);

  // Quando o usuário clica enquanto as referências carregam, marcamos
  // `pendingExportRef` e, assim que `refsLoading` virar false, disparamos
  // o handler novamente — assim o caminho correto (2 ou 3) é tomado.
  useEffect(() => {
    if (!refsLoading && pendingExportRef.current) {
      pendingExportRef.current = false;
      if (loadingToastIdRef.current !== null) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
      handleClick();
    }
  }, [refsLoading, handleClick]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!isReady || busy}
        className="gap-1.5"
        title="Exportar Cockpit + Plan×Real×Projetado para PDF"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Exportar PDF</span>
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Recorte sem dados no período
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Os filtros atuais não retornam nenhum lançamento, contrato ou
                  folha entre <strong>{format(startDate, "MMM/yyyy", { locale: ptBR })}</strong>{" "}
                  e <strong>{format(endDate, "MMM/yyyy", { locale: ptBR })}</strong>.
                </p>
                {filtersDescription.length > 0 && (
                  <div className="rounded-md bg-muted/50 p-2 text-xs">
                    <p className="font-medium text-foreground mb-1">Recorte aplicado:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {filtersDescription.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  O PDF será gerado em branco e registrado no histórico.
                  Recomendamos limpar os filtros ou ampliar o horizonte antes
                  de continuar.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:space-x-0 gap-2">
            <AlertDialogCancel className="mt-0">Revisar filtros</AlertDialogCancel>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              {onClearAllFilters && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClearAllFilters();
                    setConfirmOpen(false);
                    toast.success("Filtros limpos", {
                      description: "Clique em Exportar PDF novamente para gerar o relatório completo.",
                    });
                  }}
                >
                  Limpar todos os filtros
                </Button>
              )}
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false);
                  void runExport();
                }}
              >
                Exportar mesmo assim
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type Horizon = "3m" | "6m" | "12m" | "24m" | "custom";

const ALL_TABS = [
  { key: "cockpit", label: "Cockpit" },
  { key: "orcamento", label: "Orçamento & Realizado" },
  { key: "cenarios-risco", label: "Cenários & Risco" },
  { key: "operacional", label: "Operacional" },
];

export default function Planejamento() {
  const [horizon, setHorizon] = useState<Horizon>("12m");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [budgetVersionId, setBudgetVersionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { getAllowedTabs } = useUserPermissions();

  const allowedTabs = getAllowedTabs("planejamento", ALL_TABS);
  const fallbackTab = allowedTabs[0]?.key || "cockpit";

  // Active tab + filtros operacionais (unidade/conta/cc) persistem no URL para
  // permitir refresh, back/forward e compartilhamento de links com a mesma visão.
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<PlanningFilters>(() => {
    const parseList = (key: string): string[] =>
      searchParams.get(key)?.split(",").filter(Boolean) ?? [];
    return withFilterDefaults({
      subsidiaryOrgId: searchParams.get("org"),
      bankAccountIds: parseList("conta"),
      costCenterIds: parseList("cc"),
    });
  }, [searchParams]);

  const setFilters = useCallback((next?: PlanningFilters | Partial<PlanningFilters> | null) => {
    const safe = withFilterDefaults(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const applyOne = (key: string, value: string | null) => {
        if (value) params.set(key, value);
        else params.delete(key);
      };
      const applyList = (key: string, values: string[]) => {
        if (values.length > 0) params.set(key, values.join(","));
        else params.delete(key);
      };
      applyOne("org", safe.subsidiaryOrgId);
      applyList("conta", safe.bankAccountIds);
      applyList("cc", safe.costCenterIds);
      return params;
    }, { replace: true });
  }, [setSearchParams]);
  const urlTab = searchParams.get("tab");
  const activeTab =
    urlTab && allowedTabs.some((t) => t.key === urlTab) ? urlTab : fallbackTab;

  const setActiveTab = useCallback(
    (tab: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!tab || tab === fallbackTab) next.delete("tab");
          else next.set("tab", tab);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams, fallbackTab],
  );

  // If the URL carries an unknown/forbidden tab, normalise it once.
  useEffect(() => {
    if (urlTab && !allowedTabs.some((t) => t.key === urlTab)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("tab");
          return next;
        },
        { replace: true },
      );
    }
  }, [urlTab, allowedTabs, setSearchParams]);

  // Navegação programática vinda dos alertas do Cockpit
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab: string }>).detail?.tab;
      if (tab && allowedTabs.some((t) => t.key === tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener(PLANNING_NAV_EVENT, handler);
    return () => window.removeEventListener(PLANNING_NAV_EVENT, handler);
  }, [allowedTabs, setActiveTab]);

  // ===== Sanitização de filtros =====
  // Após o carregamento das listas de referência, remove IDs órfãos do URL
  // (ex: conta excluída, CC desativado, link compartilhado de outra org).
  // Avisa o usuário uma vez por sanitização — sem o ref, o setFilters re-dispara
  // o effect e o toast apareceria infinitamente.
  const { allBankAccounts: refBankAccounts, isLoading: isLoadingBank } = useBankAccounts();
  const { costCenters: refCostCenters, isLoading: isLoadingCc } = useCostCenters();
  const { subsidiaryOrgs: refSubsidiaries, isLoading: isLoadingHolding } = useHolding();
  const sanitizedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoadingBank || isLoadingCc || isLoadingHolding) return;
    if (!hasAnyFilter(filters)) return;

    const valid = {
      orgIds: new Set(refSubsidiaries.map((o) => o.id)),
      bankIds: new Set(refBankAccounts.map((b) => b.id)),
      ccIds: new Set(refCostCenters.map((c) => c.id)),
    };
    const { sanitized, removed } = sanitizeFilters(filters, valid);
    if (removed.length === 0) return;

    // Evita re-disparo ao mesmo conjunto de filtros já corrigido.
    const signature = JSON.stringify({ ...filters, _r: removed });
    if (sanitizedSignatureRef.current === signature) return;
    sanitizedSignatureRef.current = signature;

    setFilters(sanitized);
    const totalRemoved = removed.reduce((s, r) => s + r.count, 0);
    const dims = removed.map((r) => r.dimension).join(", ");
    toast.info(
      `Removemos ${totalRemoved} filtro(s) que não existem mais nesta organização.`,
      { description: `Dimensão(ões) afetada(s): ${dims}.` },
    );
  }, [
    filters, setFilters,
    refBankAccounts, refCostCenters, refSubsidiaries,
    isLoadingBank, isLoadingCc, isLoadingHolding,
  ]);

  // Sinal vindo do ExportPdfButton para o FilterPopover poder exibir nota
  // quando filtros ativos resultam em zero dados no horizonte.
  const [hasFilteredData, setHasFilteredData] = useState(true);
  const hasActiveFiltersWithoutData = hasAnyFilter(filters) && !hasFilteredData;

  // ===== Pré-validação para o botão de exportar =====
  // Detecta inconsistências instantaneamente (sem esperar o effect de
  // sanitização) para que o clique em "Exportar PDF" devolva mensagem
  // amigável precisa, mesmo se o usuário clicar antes da limpeza automática.
  const refsLoadingForExport = isLoadingBank || isLoadingCc || isLoadingHolding;
  const exportInvalidFilters = useMemo(() => {
    if (refsLoadingForExport || !hasAnyFilter(filters)) return [];
    const valid = {
      orgIds: new Set(refSubsidiaries.map((o) => o.id)),
      bankIds: new Set(refBankAccounts.map((b) => b.id)),
      ccIds: new Set(refCostCenters.map((c) => c.id)),
    };
    return sanitizeFilters(filters, valid).removed;
  }, [filters, refsLoadingForExport, refSubsidiaries, refBankAccounts, refCostCenters]);

  // Resumo legível do recorte aplicado — exibido no diálogo de "sem dados"
  // para o usuário entender por que o resultado ficou vazio.
  const exportFiltersDescription = useMemo(() => {
    const desc: string[] = [];
    if (filters.subsidiaryOrgId) {
      const org = refSubsidiaries.find((o) => o.id === filters.subsidiaryOrgId);
      desc.push(`Unidade: ${org?.name ?? filters.subsidiaryOrgId.slice(0, 8)}`);
    }
    if (filters.bankAccountIds.length > 0) {
      const names = filters.bankAccountIds
        .map((id) => refBankAccounts.find((b) => b.id === id)?.nome ?? id.slice(0, 8))
        .slice(0, 3)
        .join(", ");
      const extra = filters.bankAccountIds.length > 3 ? ` (+${filters.bankAccountIds.length - 3})` : "";
      desc.push(`Conta(s) bancária(s): ${names}${extra}`);
    }
    if (filters.costCenterIds.length > 0) {
      const names = filters.costCenterIds
        .map((id) => refCostCenters.find((c) => c.id === id)?.name ?? id.slice(0, 8))
        .slice(0, 3)
        .join(", ");
      const extra = filters.costCenterIds.length > 3 ? ` (+${filters.costCenterIds.length - 3})` : "";
      desc.push(`Centro(s) de custo: ${names}${extra}`);
    }
    return desc;
  }, [filters, refSubsidiaries, refBankAccounts, refCostCenters]);

  const { startDate, endDate } = useMemo(() => {
    const now = startOfMonth(new Date());
    if (horizon === "custom" && customFrom && customTo) {
      return { startDate: startOfMonth(customFrom), endDate: endOfMonth(customTo) };
    }
    const monthsMap: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12, "24m": 24 };
    const m = monthsMap[horizon] ?? 12;
    return { startDate: now, endDate: endOfMonth(addMonths(now, m - 1)) };
  }, [horizon, customFrom, customTo]);

  const renderTabContent = (tabKey: string) => {
    switch (tabKey) {
      case "cockpit":
        return <PlanningCockpit startDate={startDate} endDate={endDate} filters={filters} />;
      case "orcamento":
        return (
          <PlanningBudget
            startDate={startDate}
            endDate={endDate}
            selectedVersionId={budgetVersionId}
            onSelectVersion={setBudgetVersionId}
            filters={filters}
          />
        );
      case "cenarios-risco":
        return <PlanningScenariosRisk startDate={startDate} endDate={endDate} />;
      case "operacional":
        return <PlanningOperational startDate={startDate} endDate={endDate} />;
      default:
        return null;
    }
  };

  return (
    <PlanningScenarioProvider>
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Planejamento Financeiro"
        description="Cockpit executivo, orçamento, cenários de risco e operação — apoio à decisão estratégica"
      />

      {/* Sticky Horizon Filter + Settings */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-background/80 backdrop-blur-sm border-b border-border flex flex-wrap items-center gap-3">
        <Select value={horizon} onValueChange={(v) => setHorizon(v as Horizon)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Horizonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">3 meses</SelectItem>
            <SelectItem value="6m">6 meses</SelectItem>
            <SelectItem value="12m">12 meses</SelectItem>
            <SelectItem value="24m">24 meses</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {horizon === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customFrom ? format(customFrom, "MMM/yy", { locale: ptBR }) : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">a</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1", !customTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customTo ? format(customTo, "MMM/yy", { locale: ptBR }) : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {format(startDate, "MMM/yyyy", { locale: ptBR })} — {format(endDate, "MMM/yyyy", { locale: ptBR })}
        </span>

        <ScenarioPicker />

        <FilterPopover
          filters={filters}
          setFilters={setFilters}
          hasActiveFiltersWithoutData={hasActiveFiltersWithoutData}
        />

        <ExportPdfButton
          startDate={startDate}
          endDate={endDate}
          budgetVersionId={budgetVersionId}
          filters={filters}
          onHasFilteredDataChange={setHasFilteredData}
          refsLoading={refsLoadingForExport}
          invalidFilters={exportInvalidFilters}
          filtersDescription={exportFiltersDescription}
          onClearInvalidFilters={() => {
            // Re-aplica sanitizeFilters com as referências atuais — remove
            // somente os IDs que não existem mais, preservando o restante.
            const valid = {
              orgIds: new Set(refSubsidiaries.map((o) => o.id)),
              bankIds: new Set(refBankAccounts.map((b) => b.id)),
              ccIds: new Set(refCostCenters.map((c) => c.id)),
            };
            setFilters(sanitizeFilters(filters, valid).sanitized);
          }}
          onClearAllFilters={() => setFilters(EMPTY_PLANNING_FILTERS)}
        />

        <PlanningReportHistory />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(true)}
          className="gap-1.5"
          title="Configurações de planejamento"
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Configurações</span>
        </Button>
      </div>

      {/* Tabs — 4 main areas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full flex-wrap">
          {allowedTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1 min-w-[140px]">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {allowedTabs.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {renderTabContent(t.key)}
          </TabsContent>
        ))}
      </Tabs>

      <PlanningSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
    </PlanningScenarioProvider>
  );
}
