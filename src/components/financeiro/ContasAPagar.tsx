import { useState } from "react";
import { useFinanceiro, FinanceiroInput, FinanceiroEntry } from "@/hooks/useFinanceiro";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { FinanceiroEntryDialog } from "./FinanceiroEntryDialog";
import { FinanceiroTable } from "./FinanceiroTable";
import { PendenciasPanel } from "./PendenciasPanel";
import { MaterializeDialog } from "./MaterializeDialog";
import { DuplicateAlerts } from "./DuplicateAlerts";
import { ExpenseRequestButton } from "./ExpenseRequestButton";
import { PendingExpenseRequests } from "./PendingExpenseRequests";
import { Plus, Loader2, TrendingDown, Wallet, Clock } from "lucide-react";
import { useUpdateRequest } from "@/hooks/useRequests";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function ContasAPagar() {
  const { entries, totals, isLoading, create, markAsPaid, remove } = useFinanceiro("saida");
  const duplicates = useDuplicateDetection(entries);
  const updateRequest = useUpdateRequest();
  const [showCreate, setShowCreate] = useState(false);
  const [prefill, setPrefill] = useState<Partial<FinanceiroInput> | undefined>();

  // Materialize dialog state
  const [materializeEntries, setMaterializeEntries] = useState<FinanceiroEntry[]>([]);
  const [showMaterialize, setShowMaterialize] = useState(false);

  const handleClassify = (projectedEntries: FinanceiroEntry[]) => {
    setMaterializeEntries(projectedEntries);
    setShowMaterialize(true);
  };

  const handleMaterializeConfirm = async (
    items: { id: string; valor_realizado: number; data_realizada: string; isProjected: true }[]
  ) => {
    for (const item of items) {
      await markAsPaid.mutateAsync(item);
    }
  };

  const handleApproveRequest = async (req: any) => {
    let estimated = 0;
    try {
      const parsed = JSON.parse(req.description || "{}");
      estimated = parsed.estimated_value || 0;
    } catch {}

    setPrefill({
      descricao: req.title,
      cost_center_id: req.cost_center_id,
      valor_previsto: estimated,
      valor_bruto: estimated,
      source: "manual",
      tipo: "saida",
    });
    setShowCreate(true);

    await updateRequest.mutateAsync({ id: req.id, status: "em_execucao" });
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

      {/* Alerts */}
      <PendenciasPanel entries={entries} onClassify={handleClassify} />
      <DuplicateAlerts duplicates={duplicates} />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <ExpenseRequestButton />
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

      <FinanceiroEntryDialog
        open={showCreate}
        onOpenChange={(open) => { setShowCreate(open); if (!open) setPrefill(undefined); }}
        tipo="saida"
        onSave={async (input) => { await create.mutateAsync(input); }}
        isPending={create.isPending}
        initial={prefill}
      />

      <MaterializeDialog
        open={showMaterialize}
        onOpenChange={setShowMaterialize}
        entries={materializeEntries}
        onConfirm={handleMaterializeConfirm}
        isPending={markAsPaid.isPending}
      />
    </div>
  );
}
