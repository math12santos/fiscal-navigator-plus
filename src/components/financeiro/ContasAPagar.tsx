import { useState } from "react";
import { useFinanceiro, FinanceiroInput, FinanceiroEntry } from "@/hooks/useFinanceiro";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { FinanceiroEntryDialog } from "./FinanceiroEntryDialog";
import { FinanceiroTable } from "./FinanceiroTable";
import { PendenciasPanel } from "./PendenciasPanel";
import { ValorExecutadoDialog } from "./ValorExecutadoDialog";
import { ClassificacaoDialog } from "./ClassificacaoDialog";
import { DuplicateAlerts } from "./DuplicateAlerts";
import { ExpenseRequestButton } from "./ExpenseRequestButton";
import { PendingExpenseRequests } from "./PendingExpenseRequests";
import { ImportDialog } from "./ImportDialog";
import { PMPMRKpiCard } from "./PMPMRKpiCard";
import { Plus, Loader2, TrendingDown, Wallet, Clock, FileUp } from "lucide-react";
import { useUpdateRequest, type Request } from "@/hooks/useRequests";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function ContasAPagar() {
  const { entries, totals, isLoading, create, markAsPaid, remove } = useFinanceiro("saida");
  const duplicates = useDuplicateDetection(entries);
  const updateRequest = useUpdateRequest();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [prefill, setPrefill] = useState<Partial<FinanceiroInput> | undefined>();
  const [showImport, setShowImport] = useState(false);

  // Valor Executado dialog
  const [executadoEntries, setExecutadoEntries] = useState<FinanceiroEntry[]>([]);
  const [showExecutado, setShowExecutado] = useState(false);

  // Classificação dialog
  const [showClassify, setShowClassify] = useState(false);
  const [classifyRequest, setClassifyRequest] = useState<Request | null>(null);
  const [classifyProjections, setClassifyProjections] = useState<FinanceiroEntry[]>([]);

  // Handle classify projections (DP/contracts)
  const handleClassifyProjections = (projectedEntries: FinanceiroEntry[]) => {
    setClassifyRequest(null);
    setClassifyProjections(projectedEntries);
    setShowClassify(true);
  };

  // Handle classify expense request
  const handleClassifyRequest = (req: Request) => {
    setClassifyProjections([]);
    setClassifyRequest(req);
    setShowClassify(true);
  };

  // Handle valor executado
  const handleValorExecutado = (projectedEntries: FinanceiroEntry[]) => {
    setExecutadoEntries(projectedEntries);
    setShowExecutado(true);
  };

  const handleExecutadoConfirm = async (
    items: { id: string; valor_realizado: number; data_realizada: string; isProjected: true }[]
  ) => {
    for (const item of items) {
      await markAsPaid.mutateAsync(item);
    }
  };

  // Classify and generate cashflow entry from request
  const handleClassifyRequestConfirm = async (requestId: string, data: any) => {
    const req = classifyRequest;
    if (!req) return;

    let estimated = 0;
    try {
      const parsed = JSON.parse(req.description || "{}");
      estimated = parsed.estimated_value || 0;
    } catch {}

    // Create cashflow entry
    const entry = await create.mutateAsync({
      descricao: req.title,
      tipo: "saida",
      source: "manual",
      valor_previsto: data.valor_previsto || estimated,
      valor_bruto: data.valor_previsto || estimated,
      valor_desconto: 0,
      valor_juros_multa: 0,
      data_prevista: data.data_vencimento || new Date().toISOString().slice(0, 10),
      data_vencimento: data.data_vencimento || null,
      competencia: data.competencia || null,
      account_id: data.account_id || null,
      cost_center_id: data.cost_center_id || null,
      entity_id: req.entity_id || null,
      natureza_contabil: data.natureza_contabil || null,
      notes: data.notes || null,
      status: "pendente",
      categoria: null,
      valor_realizado: null,
      data_realizada: null,
      contract_id: null,
      contract_installment_id: null,
      documento: null,
      tipo_documento: null,
      tipo_despesa: null,
      subcategoria_id: null,
      impacto_fluxo_caixa: true,
      impacto_orcamento: true,
      afeta_caixa_no_vencimento: true,
      conta_contabil_ref: null,
      forma_pagamento: null,
      conta_bancaria_id: null,
      num_parcelas: null,
      recorrencia: null,
      conciliacao_id: null,
    } as FinanceiroInput);

    // Update request status
    await updateRequest.mutateAsync({
      id: requestId,
      status: "classificada",
      classified_by: user?.id,
      classified_at: new Date().toISOString(),
      cashflow_entry_id: (entry as any)?.id || null,
    } as any);
  };

  // Classify projections and materialize
  const handleClassifyProjectionsConfirm = async (
    items: { entry: FinanceiroEntry; classification: any }[],
    saveRule?: boolean
  ) => {
    for (const { entry, classification } of items) {
      await markAsPaid.mutateAsync({
        id: entry.id,
        valor_realizado: classification.valor_previsto || entry.valor_previsto,
        data_realizada: classification.data_vencimento || entry.data_prevista,
        isProjected: true,
      });
    }
    // TODO: If saveRule is true, persist a classification_mapping for future auto-classification
  };

  // Legacy approve handler for PendingExpenseRequests
  const handleApproveRequest = async (req: any) => {
    handleClassifyRequest(req);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Previsto" value={fmt(totals.total_previsto)} icon={<TrendingDown size={20} />} />
        <KPICard title="Total Pago" value={fmt(totals.total_realizado)} icon={<Wallet size={20} />} />
        <KPICard title="Pendente" value={`${fmt(totals.pendente)} (${totals.count_pendente})`} icon={<Clock size={20} />} />
      </div>

      {/* Triage panel */}
      <PendenciasPanel
        entries={entries}
        onClassify={handleClassifyProjections}
        onValorExecutado={handleValorExecutado}
        onClassifyRequest={handleClassifyRequest}
      />
      <DuplicateAlerts duplicates={duplicates} onDelete={(id) => remove.mutate(id)} />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <ExpenseRequestButton />
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
          <FileUp className="h-4 w-4 mr-1" /> Importar CSV/XLSX
        </Button>
        <Button size="sm" onClick={() => { setPrefill(undefined); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Despesa
        </Button>
      </div>

      {/* Pending expense requests */}
      <PendingExpenseRequests onApprove={handleApproveRequest} />

      {/* Main table */}
      <FinanceiroTable
        entries={entries}
        tipo="saida"
        onMarkAsPaid={(data) => markAsPaid.mutate(data)}
        onDelete={(id) => remove.mutate(id)}
        isDeleting={remove.isPending}
      />

      {/* New expense dialog */}
      <FinanceiroEntryDialog
        open={showCreate}
        onOpenChange={(open) => { setShowCreate(open); if (!open) setPrefill(undefined); }}
        tipo="saida"
        onSave={async (input) => { await create.mutateAsync(input); }}
        isPending={create.isPending}
        initial={prefill}
      />

      {/* Classification dialog */}
      <ClassificacaoDialog
        open={showClassify}
        onOpenChange={(open) => { setShowClassify(open); if (!open) { setClassifyRequest(null); setClassifyProjections([]); } }}
        request={classifyRequest}
        projections={classifyProjections.length > 0 ? classifyProjections : undefined}
        onConfirmRequest={handleClassifyRequestConfirm}
        onConfirmProjections={handleClassifyProjectionsConfirm}
        isPending={create.isPending || markAsPaid.isPending}
      />

      {/* Valor Executado dialog */}
      <ValorExecutadoDialog
        open={showExecutado}
        onOpenChange={setShowExecutado}
        entries={executadoEntries}
        onConfirm={handleExecutadoConfirm}
        isPending={markAsPaid.isPending}
      />

      {/* Import dialog */}
      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        tipo="saida"
      />
    </div>
  );
}
