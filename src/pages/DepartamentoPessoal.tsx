import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import DPDashboard from "@/components/dp/DPDashboard";
import DPColaboradores from "@/components/dp/DPColaboradores";
import DPFolha from "@/components/dp/DPFolha";
import DPFerias from "@/components/dp/DPFerias";
import DPRescisoes from "@/components/dp/DPRescisoes";
import DPEncargos from "@/components/dp/DPEncargos";
import DPCargos from "@/components/dp/DPCargos";
import DPConfig from "@/components/dp/DPConfig";

export default function DepartamentoPessoal() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Departamento Pessoal"
        description="Gestão de colaboradores, folha de pagamento, encargos e planejamento de RH"
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
          <TabsTrigger value="ferias">Férias / 13º</TabsTrigger>
          <TabsTrigger value="rescisoes">Rescisões</TabsTrigger>
          <TabsTrigger value="encargos">Encargos</TabsTrigger>
          <TabsTrigger value="cargos">Cargos & Rotinas</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DPDashboard /></TabsContent>
        <TabsContent value="colaboradores"><DPColaboradores /></TabsContent>
        <TabsContent value="folha"><DPFolha /></TabsContent>
        <TabsContent value="ferias"><DPFerias /></TabsContent>
        <TabsContent value="rescisoes"><DPRescisoes /></TabsContent>
        <TabsContent value="encargos"><DPEncargos /></TabsContent>
        <TabsContent value="cargos"><DPCargos /></TabsContent>
        <TabsContent value="config"><DPConfig /></TabsContent>
      </Tabs>
    </div>
  );
}
