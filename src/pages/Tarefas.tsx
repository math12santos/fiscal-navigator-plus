import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { TarefasDashboard } from "@/components/tarefas/TarefasDashboard";
import { SolicitacoesTab } from "@/components/tarefas/SolicitacoesTab";
import { MinhasTarefasTab } from "@/components/tarefas/MinhasTarefasTab";
import { TarefasCalendario } from "@/components/tarefas/TarefasCalendario";

const ALL_TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "calendario", label: "Calendário" },
  { key: "solicitacoes", label: "Solicitações" },
  { key: "minhas-tarefas", label: "Minhas Tarefas" },
];

export default function Tarefas() {
  const { getAllowedTabs } = useUserPermissions();
  const tabs = getAllowedTabs("tarefas", ALL_TABS);
  const defaultTab = tabs[0]?.key ?? "dashboard";

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Gestão de Solicitações" description="Solicitações, tarefas, rotinas e workflow interno" />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <TarefasDashboard />
        </TabsContent>

        <TabsContent value="calendario">
          <TarefasCalendario />
        </TabsContent>

        <TabsContent value="solicitacoes">
          <SolicitacoesTab />
        </TabsContent>

        <TabsContent value="minhas-tarefas">
          <MinhasTarefasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
