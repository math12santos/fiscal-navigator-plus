import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUrlState } from "@/hooks/useUrlState";
import { PageHeader } from "@/components/PageHeader";
import { SectorOnboardingBar } from "@/components/sector-onboarding/SectorOnboardingBar";
import { TIDashboard } from "@/components/ti/TIDashboard";
import { EquipmentTab } from "@/components/ti/EquipmentTab";
import { SystemsTab } from "@/components/ti/SystemsTab";
import { TelecomTab } from "@/components/ti/TelecomTab";
import { TicketsTab } from "@/components/ti/TicketsTab";
import { IncidentsTab } from "@/components/ti/IncidentsTab";
import { DepreciationTab } from "@/components/ti/DepreciationTab";
import { TIConfigTab } from "@/components/ti/TIConfigTab";
import { TCOTab } from "@/components/ti/TCOTab";
import { useEffect } from "react";

export default function TI() {
  const [tab, setTab] = useUrlState("tab", "dashboard");
  useEffect(() => { document.title = "TI & Patrimônio Tech | FinCore"; }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="TI & Patrimônio Tech"
        description="Equipamentos, sistemas, links, chamados, sinistros e integração financeira."
      />

      <SectorOnboardingBar sector="ti" onTabChange={setTab} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap bg-muted/40 border border-border p-1 h-auto">
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="equipamentos" className="text-xs">Equipamentos</TabsTrigger>
          <TabsTrigger value="sistemas" className="text-xs">Sistemas</TabsTrigger>
          <TabsTrigger value="telecom" className="text-xs">Links / Telecom</TabsTrigger>
          <TabsTrigger value="chamados" className="text-xs">Chamados</TabsTrigger>
          <TabsTrigger value="sinistros" className="text-xs">Sinistros</TabsTrigger>
          <TabsTrigger value="depreciacao" className="text-xs">Depreciação</TabsTrigger>
          <TabsTrigger value="tco" className="text-xs">TCO</TabsTrigger>
          <TabsTrigger value="config" className="text-xs">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><TIDashboard /></TabsContent>
        <TabsContent value="equipamentos"><EquipmentTab /></TabsContent>
        <TabsContent value="sistemas"><SystemsTab /></TabsContent>
        <TabsContent value="telecom"><TelecomTab /></TabsContent>
        <TabsContent value="chamados"><TicketsTab /></TabsContent>
        <TabsContent value="sinistros"><IncidentsTab /></TabsContent>
        <TabsContent value="depreciacao"><DepreciationTab /></TabsContent>
        <TabsContent value="tco"><TCOTab /></TabsContent>
        <TabsContent value="config"><TIConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}
