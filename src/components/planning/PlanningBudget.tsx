import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import BudgetTab from "@/components/planning/BudgetTab";
import PlannedVsActual from "@/components/planning/PlannedVsActual";
import type { PlanningFilters } from "@/lib/planningFilters";

interface Props {
  startDate: Date;
  endDate: Date;
  selectedVersionId: string | null;
  onSelectVersion: (id: string | null) => void;
  filters?: PlanningFilters;
}

export default function PlanningBudget({
  startDate, endDate, selectedVersionId, onSelectVersion, filters,
}: Props) {
  return (
    <Tabs defaultValue="linhas" className="space-y-4">
      <TabsList className="bg-muted/50">
        <TabsTrigger value="linhas">Linhas do Orçamento</TabsTrigger>
        <TabsTrigger value="comparativo">Comparativo Plan × Real × Projetado</TabsTrigger>
      </TabsList>

      <TabsContent value="linhas">
        <BudgetTab
          startDate={startDate}
          endDate={endDate}
          selectedVersionId={selectedVersionId}
          onSelectVersion={onSelectVersion}
        />
      </TabsContent>

      <TabsContent value="comparativo">
        <PlannedVsActual
          startDate={startDate}
          endDate={endDate}
          budgetVersionId={selectedVersionId}
          filters={filters}
        />
      </TabsContent>
    </Tabs>
  );
}
