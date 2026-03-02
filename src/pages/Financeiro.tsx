import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ContasAPagar } from "@/components/financeiro/ContasAPagar";
import { ContasAReceber } from "@/components/financeiro/ContasAReceber";

const ALL_TABS = [
  { key: "pagar", label: "Contas a Pagar" },
  { key: "receber", label: "Contas a Receber" },
];

export default function Financeiro() {
  const { getAllowedTabs } = useUserPermissions();
  const allowedTabs = getAllowedTabs("financeiro", ALL_TABS);
  const [activeTab, setActiveTab] = useState(allowedTabs[0]?.key || "pagar");

  if (allowedTabs.length === 0) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader title="Financeiro" description="Você não possui permissão para acessar este módulo." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financeiro"
        description="Gestão de contas a pagar e contas a receber"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {allowedTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {allowedTabs.some((t) => t.key === "pagar") && (
          <TabsContent value="pagar">
            <ContasAPagar />
          </TabsContent>
        )}
        {allowedTabs.some((t) => t.key === "receber") && (
          <TabsContent value="receber">
            <ContasAReceber />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
