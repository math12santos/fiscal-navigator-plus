import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCRMClients, useCRMActivities, usePipelineStages, useCRMOpportunities, CRMClient, CRMOpportunity } from "@/hooks/useCRM";
import { useCRMIntelligence } from "@/hooks/useCRMIntelligence";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const ALL_TABS = [
  { key: "carteira", label: "Carteira" },
  { key: "pipeline", label: "Pipeline" },
  { key: "indicadores", label: "Indicadores" },
];
import { useContracts } from "@/hooks/useContracts";
import { CRMClientTable } from "@/components/crm/CRMClientTable";
import { CRMClientDialog } from "@/components/crm/CRMClientDialog";
import { CRMClientDetail } from "@/components/crm/CRMClientDetail";
import { CRMPipeline } from "@/components/crm/CRMPipeline";
import { CRMOpportunityDialog } from "@/components/crm/CRMOpportunityDialog";
import { CRMIndicators } from "@/components/crm/CRMIndicators";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function CRM() {
  const { getAllowedTabs } = useUserPermissions();
  const allowedTabs = getAllowedTabs("crm", ALL_TABS);
  const { toast } = useToast();
  const { clients, isLoading: clientsLoading, create: createClient, update: updateClient, remove: removeClient } = useCRMClients();
  const { stages, isLoading: stagesLoading } = usePipelineStages();
  const { opportunities, isLoading: oppsLoading, create: createOpp, update: updateOpp, remove: removeOpp, moveToStage } = useCRMOpportunities();
  const { create: createContract } = useContracts();

  const [selectedClient, setSelectedClient] = useState<CRMClient | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CRMClient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<CRMOpportunity | null>(null);
  const [wonOpp, setWonOpp] = useState<CRMOpportunity | null>(null);

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

  const handleWonOpportunity = (opp: CRMOpportunity) => {
    setWonOpp(opp);
  };

  const handleCreateContractFromOpp = () => {
    if (!wonOpp) return;
    const client = clients.find((c) => c.id === wonOpp.client_id);
    createContract.mutate({
      nome: wonOpp.title,
      tipo: wonOpp.contract_type === "compra" ? "compra" : wonOpp.contract_type === "patrimonio" ? "patrimonio" : "venda",
      valor: Number(wonOpp.estimated_value),
      valor_base: Number(wonOpp.estimated_value),
      vencimento: wonOpp.estimated_close_date || new Date().toISOString().split("T")[0],
      status: "Ativo",
      tipo_recorrencia: wonOpp.recurrence || "mensal",
      prazo_indeterminado: false,
      entity_id: client?.entity_id || null,
      product_id: null,
      notes: wonOpp.notes,
      data_inicio: new Date().toISOString().split("T")[0],
      data_fim: null,
      intervalo_personalizado: null,
      dia_vencimento: null,
      tipo_reajuste: "manual",
      indice_reajuste: null,
      percentual_reajuste: null,
      periodicidade_reajuste: "anual",
      proximo_reajuste: null,
      natureza_financeira: "fixo",
      impacto_resultado: "receita",
      cost_center_id: null,
      responsavel_interno: wonOpp.responsible,
      area_responsavel: null,
      sla_revisao_dias: null,
      finalidade: null,
      operacao: wonOpp.contract_type || "venda",
      subtipo_operacao: null,
      rendimento_mensal_esperado: null,
    } as any, {
      onSuccess: () => {
        toast({ title: "Contrato criado a partir da oportunidade" });
        setWonOpp(null);
      },
    });
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
        <Tabs defaultValue={allowedTabs[0]?.key || "carteira"} className="space-y-4">
          <TabsList className="flex-wrap bg-muted/40 border border-border p-1 h-auto">
            {allowedTabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
            ))}
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
              onWonOpportunity={handleWonOpportunity}
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

      {/* Won opportunity → Create contract dialog */}
      <Dialog open={!!wonOpp} onOpenChange={() => setWonOpp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Oportunidade Fechada!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A oportunidade <strong>{wonOpp?.title}</strong> foi marcada como ganha.
            Deseja criar um contrato automaticamente?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWonOpp(null)}>Não, obrigado</Button>
            <Button onClick={handleCreateContractFromOpp}>Criar Contrato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
