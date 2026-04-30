import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUrlState } from "@/hooks/useUrlState";
import { useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SectorOnboardingBar } from "@/components/sector-onboarding/SectorOnboardingBar";
import { JuridicoDashboard } from "@/components/juridico/JuridicoDashboard";
import { JuridicoProcessesTab } from "@/components/juridico/JuridicoProcessesTab";
import { JuridicoSettlementsTab } from "@/components/juridico/JuridicoSettlementsTab";
import { JuridicoExpensesTab } from "@/components/juridico/JuridicoExpensesTab";
import { JuridicoRiskMatrix } from "@/components/juridico/JuridicoRiskMatrix";
import { JuridicoConfigTab } from "@/components/juridico/JuridicoConfigTab";

export default function Juridico() {
  const [tab, setTab] = useUrlState("tab", "dashboard");
  useEffect(() => {
    document.title = "Jurídico | FinCore";
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <PageHeader
        title="Jurídico"
        description="Gestão de processos, riscos, provisões e impacto financeiro de contingências."
      />

      <SectorOnboardingBar sector="juridico" onTabChange={setTab} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="acordos">Acordos</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="risco">Matriz de Risco</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><JuridicoDashboard /></TabsContent>
        <TabsContent value="processos"><JuridicoProcessesTab /></TabsContent>
        <TabsContent value="acordos"><JuridicoSettlementsTab /></TabsContent>
        <TabsContent value="despesas"><JuridicoExpensesTab /></TabsContent>
        <TabsContent value="risco"><JuridicoRiskMatrix /></TabsContent>
        <TabsContent value="config"><JuridicoConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}
