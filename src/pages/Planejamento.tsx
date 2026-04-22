import { useState, useMemo, useEffect } from "react";
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
import { CalendarIcon, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import PlanningCockpit, { PLANNING_NAV_EVENT } from "@/components/planning/PlanningCockpit";
import PlanningBudget from "@/components/planning/PlanningBudget";
import PlanningScenariosRisk from "@/components/planning/PlanningScenariosRisk";
import PlanningOperational from "@/components/planning/PlanningOperational";
import PlanningSettingsDialog from "@/components/planning/PlanningSettingsDialog";
import { PlanningScenarioProvider, usePlanningScenarioContext } from "@/contexts/PlanningScenarioContext";

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
  const [activeTab, setActiveTab] = useState<string>(allowedTabs[0]?.key || "cockpit");

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
  }, [allowedTabs]);

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
