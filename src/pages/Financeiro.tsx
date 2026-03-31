import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ContasAPagar } from "@/components/financeiro/ContasAPagar";
import { ContasAReceber } from "@/components/financeiro/ContasAReceber";
import { ContasBancariasTab } from "@/components/financeiro/ContasBancariasTab";
import { AgingListTab } from "@/components/financeiro/AgingListTab";
import { ImportacoesTab } from "@/components/financeiro/ImportacoesTab";
import { FluxoCaixaTab } from "@/components/financeiro/FluxoCaixaTab";
import { ConciliacaoTab } from "@/components/financeiro/ConciliacaoTab";

const ALL_TABS = [
  { key: "pagar", label: "Contas a Pagar" },
  { key: "receber", label: "Contas a Receber" },
  { key: "aging", label: "Aging List" },
  { key: "contas-bancarias", label: "Contas Bancárias" },
  { key: "fluxo-caixa", label: "Fluxo de Caixa" },
  { key: "conciliacao", label: "Conciliação" },
  { key: "importacoes", label: "Importações" },
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
        description="Gestão financeira completa: contas, fluxo de caixa, conciliação e importações"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          {allowedTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {allowedTabs.some((t) => t.key === "pagar") && (
          <TabsContent value="pagar"><ContasAPagar /></TabsContent>
        )}
        {allowedTabs.some((t) => t.key === "receber") && (
          <TabsContent value="receber"><ContasAReceber /></TabsContent>
        )}
        {allowedTabs.some((t) => t.key === "aging") && (
          <TabsContent value="aging"><AgingListTab /></TabsContent>
        )}
        {allowedTabs.some((t) => t.key === "contas-bancarias") && (
          <TabsContent value="contas-bancarias"><ContasBancariasTab /></TabsContent>
        )}
        {allowedTabs.some((t) => t.key === "fluxo-caixa") && (
          <TabsContent value="fluxo-caixa"><FluxoCaixaTab /></TabsContent>
        )}
        {allowedTabs.some((t) => t.key === "conciliacao") && (
          <TabsContent value="conciliacao"><ConciliacaoTab /></TabsContent>
        )}
        {allowedTabs.some((t) => t.key === "importacoes") && (
          <TabsContent value="importacoes"><ImportacoesTab /></TabsContent>
        )}
      </Tabs>
    </div>
  );
}
