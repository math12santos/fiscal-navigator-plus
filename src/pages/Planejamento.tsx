import { useState, useMemo, useEffect, useCallback } from "react";
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
import { CalendarIcon, Settings, Sparkles, FileDown, Loader2, Filter, X } from "lucide-react";
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
  PlanningFilters, EMPTY_PLANNING_FILTERS, hasAnyFilter,
} from "@/lib/planningFilters";

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
 * Pop-over com 3 selects (unidade / conta bancária / centro de custo).
 * Sentinela "__all__" representa "Todos" (Radix Select não aceita value="").
 */
function FilterPopover({
  filters, setFilters,
}: {
  filters: PlanningFilters;
  setFilters: (f: PlanningFilters) => void;
}) {
  const { costCenters } = useCostCenters();
  const { allBankAccounts } = useBankAccounts();
  const { isHolding, subsidiaryOrgs } = useHolding();
  const ALL = "__all__";
  const activeCount =
    (filters.subsidiaryOrgId ? 1 : 0) +
    (filters.bankAccountId ? 1 : 0) +
    (filters.costCenterId ? 1 : 0);

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
      <PopoverContent className="w-72 space-y-3" align="end">
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
          <label className="text-xs font-medium text-muted-foreground">Conta bancária</label>
          <Select
            value={filters.bankAccountId ?? ALL}
            onValueChange={(v) =>
              setFilters({ ...filters, bankAccountId: v === ALL ? null : v })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as contas</SelectItem>
              {allBankAccounts.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nome}{b.banco ? ` · ${b.banco}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Centro de custo</label>
          <Select
            value={filters.costCenterId ?? ALL}
            onValueChange={(v) =>
              setFilters({ ...filters, costCenterId: v === ALL ? null : v })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os centros</SelectItem>
              {costCenters.filter((c) => c.active).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
}

function ExportPdfButton({ startDate, endDate, budgetVersionId, filters }: ExportPdfButtonProps) {
  const { generatePdf, isReady } = usePlanningPdfReport({ startDate, endDate, budgetVersionId, filters });
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!isReady || busy) return;
    try {
      setBusy(true);
      await new Promise((r) => setTimeout(r, 0));
      generatePdf();
      toast.success("PDF gerado com sucesso");
    } catch (e: any) {
      toast.error("Falha ao gerar PDF", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
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
  const [filters, setFilters] = useState<PlanningFilters>(EMPTY_PLANNING_FILTERS);
  const { getAllowedTabs } = useUserPermissions();

  const allowedTabs = getAllowedTabs("planejamento", ALL_TABS);
  const fallbackTab = allowedTabs[0]?.key || "cockpit";

  // Active tab is persisted in the URL (?tab=...) so refresh, back/forward
  // and shared links preserve navigation context.
  const [searchParams, setSearchParams] = useSearchParams();
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
        return <PlanningCockpit startDate={startDate} endDate={endDate} />;
      case "orcamento":
        return (
          <PlanningBudget
            startDate={startDate}
            endDate={endDate}
            selectedVersionId={budgetVersionId}
            onSelectVersion={setBudgetVersionId}
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

        <ExportPdfButton
          startDate={startDate}
          endDate={endDate}
          budgetVersionId={budgetVersionId}
        />

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
