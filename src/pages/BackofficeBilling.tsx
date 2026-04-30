import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Users, FileText, AlertTriangle, CreditCard } from "lucide-react";
import { PlansTab } from "@/components/backoffice/billing/PlansTab";
import { SubscriptionsTab } from "@/components/backoffice/billing/SubscriptionsTab";
import { InvoicesTab } from "@/components/backoffice/billing/InvoicesTab";
import { DelinquencyTab } from "@/components/backoffice/billing/DelinquencyTab";

export default function BackofficeBilling() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard size={24} className="text-primary" /> Faturamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão completa do SaaS: planos, assinaturas, faturas e inadimplência.
        </p>
      </div>

      <Tabs defaultValue="assinaturas">
        <TabsList>
          <TabsTrigger value="assinaturas"><Users size={14} className="mr-1" /> Assinaturas</TabsTrigger>
          <TabsTrigger value="faturas"><FileText size={14} className="mr-1" /> Faturas</TabsTrigger>
          <TabsTrigger value="inadimplencia"><AlertTriangle size={14} className="mr-1" /> Inadimplência</TabsTrigger>
          <TabsTrigger value="planos"><Package size={14} className="mr-1" /> Planos</TabsTrigger>
        </TabsList>
        <TabsContent value="assinaturas" className="mt-6"><SubscriptionsTab /></TabsContent>
        <TabsContent value="faturas" className="mt-6"><InvoicesTab /></TabsContent>
        <TabsContent value="inadimplencia" className="mt-6"><DelinquencyTab /></TabsContent>
        <TabsContent value="planos" className="mt-6"><PlansTab /></TabsContent>
      </Tabs>
    </div>
  );
}
