import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContasAPagar } from "@/components/financeiro/ContasAPagar";
import { ContasAReceber } from "@/components/financeiro/ContasAReceber";

export default function Financeiro() {
  const [activeTab, setActiveTab] = useState("pagar");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financeiro"
        description="Gestão de contas a pagar e contas a receber"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
        </TabsList>
        <TabsContent value="pagar">
          <ContasAPagar />
        </TabsContent>
        <TabsContent value="receber">
          <ContasAReceber />
        </TabsContent>
      </Tabs>
    </div>
  );
}
