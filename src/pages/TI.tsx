import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUrlState } from "@/hooks/useUrlState";
import { TIDashboard } from "@/components/ti/TIDashboard";
import { EquipmentTab } from "@/components/ti/EquipmentTab";
import { SystemsTab } from "@/components/ti/SystemsTab";
import { TelecomTab } from "@/components/ti/TelecomTab";
import { TicketsTab } from "@/components/ti/TicketsTab";
import { IncidentsTab } from "@/components/ti/IncidentsTab";
import { DepreciationTab } from "@/components/ti/DepreciationTab";
import { TIConfigTab } from "@/components/ti/TIConfigTab";
import { Helmet } from "react-helmet-async";

export default function TI() {
  const [tab, setTab] = useUrlState("tab", "dashboard");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <Helmet><title>TI & Patrimônio Tech | FinCore</title></Helmet>
      <header>
        <h1 className="text-2xl font-bold">TI & Patrimônio Tech</h1>
        <p className="text-sm text-muted-foreground">Equipamentos, sistemas, links, chamados, sinistros e integração financeira.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="sistemas">Sistemas</TabsTrigger>
          <TabsTrigger value="telecom">Links / Telecom</TabsTrigger>
          <TabsTrigger value="chamados">Chamados</TabsTrigger>
          <TabsTrigger value="sinistros">Sinistros</TabsTrigger>
          <TabsTrigger value="depreciacao">Depreciação</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><TIDashboard /></TabsContent>
        <TabsContent value="equipamentos"><EquipmentTab /></TabsContent>
        <TabsContent value="sistemas"><SystemsTab /></TabsContent>
        <TabsContent value="telecom"><TelecomTab /></TabsContent>
        <TabsContent value="chamados"><TicketsTab /></TabsContent>
        <TabsContent value="sinistros"><IncidentsTab /></TabsContent>
        <TabsContent value="depreciacao"><DepreciationTab /></TabsContent>
        <TabsContent value="config"><TIConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}
