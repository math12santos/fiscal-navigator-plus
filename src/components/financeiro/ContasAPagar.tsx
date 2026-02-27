import { useState } from "react";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { FinanceiroEntryDialog } from "./FinanceiroEntryDialog";
import { FinanceiroTable } from "./FinanceiroTable";
import { Plus, Loader2, TrendingDown, Wallet, Clock } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function ContasAPagar() {
  const { entries, totals, isLoading, create, markAsPaid, remove } = useFinanceiro("saida");
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Previsto" value={fmt(totals.total_previsto)} icon={<TrendingDown size={20} />} />
        <KPICard title="Total Pago" value={fmt(totals.total_realizado)} icon={<Wallet size={20} />} />
        <KPICard title="Pendente" value={`${fmt(totals.pendente)} (${totals.count_pendente})`} icon={<Clock size={20} />} />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Despesa
        </Button>
      </div>

      <FinanceiroTable
        entries={entries}
        tipo="saida"
        onMarkAsPaid={(data) => markAsPaid.mutate(data)}
        onDelete={(id) => remove.mutate(id)}
        isDeleting={remove.isPending}
      />

      <FinanceiroEntryDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        tipo="saida"
        onSave={async (input) => { await create.mutateAsync(input); }}
        isPending={create.isPending}
      />
    </div>
  );
}
