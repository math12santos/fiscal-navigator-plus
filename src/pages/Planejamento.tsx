import { useState, useMemo } from "react";
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
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import PlanningOverview from "@/components/planning/PlanningOverview";
import BudgetTab from "@/components/planning/BudgetTab";
import PlanningScenarios from "@/components/planning/PlanningScenarios";
import PlannedVsActual from "@/components/planning/PlannedVsActual";
import PlanningLiquidity from "@/components/planning/PlanningLiquidity";
import PlanningLiabilities from "@/components/planning/PlanningLiabilities";
import PlanningCommercial from "@/components/planning/PlanningCommercial";
import PlanningHR from "@/components/planning/PlanningHR";
type Horizon = "3m" | "6m" | "12m" | "24m" | "custom";

export default function Planejamento() {
  const [horizon, setHorizon] = useState<Horizon>("12m");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [budgetVersionId, setBudgetVersionId] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const now = startOfMonth(new Date());
    if (horizon === "custom" && customFrom && customTo) {
      return { startDate: startOfMonth(customFrom), endDate: endOfMonth(customTo) };
    }
    const monthsMap: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12, "24m": 24 };
    const m = monthsMap[horizon] ?? 12;
    return { startDate: now, endDate: endOfMonth(addMonths(now, m - 1)) };
  }, [horizon, customFrom, customTo]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Planejamento Financeiro"
        description="Orçamento, projeções, cenários e gestão de passivos — apoio à decisão estratégica"
      />

      {/* Horizon Filter */}
      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="cenarios">Cenários</TabsTrigger>
          <TabsTrigger value="planejado-realizado">Plan. × Real.</TabsTrigger>
          <TabsTrigger value="liquidez">Liquidez</TabsTrigger>
          <TabsTrigger value="passivos">Passivos</TabsTrigger>
          <TabsTrigger value="rh">RH</TabsTrigger>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <PlanningOverview startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="orcamento">
          <BudgetTab
            startDate={startDate}
            endDate={endDate}
            selectedVersionId={budgetVersionId}
            onSelectVersion={setBudgetVersionId}
          />
        </TabsContent>

        <TabsContent value="cenarios">
          <PlanningScenarios startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="planejado-realizado">
          <PlannedVsActual
            startDate={startDate}
            endDate={endDate}
            budgetVersionId={budgetVersionId}
          />
        </TabsContent>

        <TabsContent value="liquidez">
          <PlanningLiquidity />
        </TabsContent>

        <TabsContent value="passivos">
          <PlanningLiabilities />
        </TabsContent>

        <TabsContent value="rh">
          <PlanningHR startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="comercial">
          <PlanningCommercial startDate={startDate} endDate={endDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
