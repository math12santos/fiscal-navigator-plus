import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCRMClients, useCRMActivities, usePipelineStages, useCRMOpportunities, CRMClient, CRMOpportunity } from "@/hooks/useCRM";
import { useCRMIntelligence } from "@/hooks/useCRMIntelligence";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { CRMClientTable } from "@/components/crm/CRMClientTable";
import { CRMClientDialog } from "@/components/crm/CRMClientDialog";
import { CRMClientDetail } from "@/components/crm/CRMClientDetail";
import { CRMPipeline } from "@/components/crm/CRMPipeline";
import { CRMOpportunityDialog } from "@/components/crm/CRMOpportunityDialog";
import { CRMIndicators } from "@/components/crm/CRMIndicators";

export default function CRM() {
  const { canAccessTab } = useUserPermissions();
  const { clients, isLoading: clientsLoading, create: createClient, update: updateClient, remove: removeClient } = useCRMClients();
  const { stages, isLoading: stagesLoading } = usePipelineStages();
  const { opportunities, isLoading: oppsLoading, create: createOpp, update: updateOpp, remove: removeOpp, moveToStage } = useCRMOpportunities();

  const [selectedClient, setSelectedClient] = useState<CRMClient | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CRMClient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<CRMOpportunity | null>(null);

  const { activities, create: createActivity } = useCRMActivities(selectedClient?.id);
  const intelligence = useCRMIntelligence(opportunities, stages, clients);

  const handleSaveClient = (data: Partial<CRMClient>) => {
    if (editingClient) {
      updateClient.mutate({ id: editingClient.id, ...data });
    } else {
      createClient.mutate(data);
    }
  };

  const handleSaveOpp = (data: Partial<CRMOpportunity>) => {
    if (editingOpp) {
      updateOpp.mutate({ id: editingOpp.id, ...data });
    } else {
      createOpp.mutate(data);
    }
  };

  const handleMoveOpp = (oppId: string, stageId: string, extras?: any) => {
    moveToStage.mutate({ id: oppId, stage_id: stageId, ...extras });
  };

  const isLoading = clientsLoading || stagesLoading || oppsLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="CRM Comercial"
        description="Gestão de carteira, pipeline de vendas e inteligência comercial"
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>
      ) : (
        <Tabs defaultValue="carteira">
          <TabsList>
            {canAccessTab("crm", "carteira") && <TabsTrigger value="carteira">Carteira</TabsTrigger>}
            {canAccessTab("crm", "pipeline") && <TabsTrigger value="pipeline">Pipeline</TabsTrigger>}
            {canAccessTab("crm", "indicadores") && <TabsTrigger value="indicadores">Indicadores</TabsTrigger>}
          </TabsList>

          <TabsContent value="carteira" className="mt-4">
            <CRMClientTable
              clients={clients}
              onAdd={() => { setEditingClient(null); setClientDialogOpen(true); }}
              onEdit={(c) => { setEditingClient(c); setClientDialogOpen(true); }}
              onDelete={(id) => removeClient.mutate(id)}
              onView={(c) => { setSelectedClient(c); setDetailOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <CRMPipeline
              stages={stages}
              opportunities={opportunities}
              clients={clients}
              onMove={handleMoveOpp}
              onAddOpportunity={() => { setEditingOpp(null); setOppDialogOpen(true); }}
              onEditOpportunity={(o) => { setEditingOpp(o); setOppDialogOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="indicadores" className="mt-4">
            <CRMIndicators data={intelligence} />
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      <CRMClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSave={handleSaveClient}
        initial={editingClient}
      />

      <CRMOpportunityDialog
        open={oppDialogOpen}
        onOpenChange={setOppDialogOpen}
        onSave={handleSaveOpp}
        initial={editingOpp}
        clients={clients}
        stages={stages}
      />

      <CRMClientDetail
        client={selectedClient}
        activities={activities}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAddActivity={(data) => createActivity.mutate(data)}
      />
    </div>
  );
}
