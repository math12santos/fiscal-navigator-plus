import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart } from "lucide-react";
import { ComprasDashboard } from "@/components/compras/ComprasDashboard";
import { RequestsTab } from "@/components/compras/RequestsTab";
import { ApprovalsTab } from "@/components/compras/ApprovalsTab";
import { OrdersTab } from "@/components/compras/OrdersTab";
import { SuppliersTab } from "@/components/compras/SuppliersTab";
import { RulesTab } from "@/components/compras/RulesTab";

export default function Compras() {
  const [tab, setTab] = useState("dashboard");
  return (
    <div className="space-y-4">
      <PageHeader
        title="Compras"
        description="Governança da jornada de compra: solicitação → aprovação → pedido → contas a pagar."
        icon={ShoppingCart}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/40 border p-1 h-auto flex flex-wrap">
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="solicitacoes" className="text-xs">Solicitações</TabsTrigger>
          <TabsTrigger value="aprovacoes" className="text-xs">Aprovações</TabsTrigger>
          <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
          <TabsTrigger value="fornecedores" className="text-xs">Fornecedores</TabsTrigger>
          <TabsTrigger value="regras" className="text-xs">Regras</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><ComprasDashboard /></TabsContent>
        <TabsContent value="solicitacoes"><RequestsTab /></TabsContent>
        <TabsContent value="aprovacoes"><ApprovalsTab /></TabsContent>
        <TabsContent value="pedidos"><OrdersTab /></TabsContent>
        <TabsContent value="fornecedores"><SuppliersTab /></TabsContent>
        <TabsContent value="regras"><RulesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
