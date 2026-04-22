import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PlanningHR from "@/components/planning/PlanningHR";
import PlanningCommercial from "@/components/planning/PlanningCommercial";
import { Users, Target } from "lucide-react";

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function PlanningOperational({ startDate, endDate }: Props) {
  return (
    <Tabs defaultValue="rh" className="space-y-4">
      <TabsList className="bg-muted/50">
        <TabsTrigger value="rh" className="gap-1.5">
          <Users className="h-3.5 w-3.5" /> Planejamento RH
        </TabsTrigger>
        <TabsTrigger value="comercial" className="gap-1.5">
          <Target className="h-3.5 w-3.5" /> Plano Comercial
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rh">
        <PlanningHR startDate={startDate} endDate={endDate} />
      </TabsContent>

      <TabsContent value="comercial">
        <PlanningCommercial startDate={startDate} endDate={endDate} />
      </TabsContent>
    </Tabs>
  );
}
