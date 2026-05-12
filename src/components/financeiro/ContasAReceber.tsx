import { useState, useMemo } from "react";
import { useFinanceiro, type FinanceiroEntry, type FinanceiroInput } from "@/hooks/useFinanceiro";
import { useFinanceiroMonthFilter, computeFinanceiroTotals } from "@/hooks/useFinanceiroMonthFilter";
import { WorkingMonthBanner, useWorkingMonthClosed } from "./WorkingMonthBanner";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { FinanceiroEntryDialog } from "./FinanceiroEntryDialog";
import { FinanceiroTable } from "./FinanceiroTable";
import { ImportDialog } from "./ImportDialog";
import { DuplicateAlerts } from "./DuplicateAlerts";
import { PMPMRKpiCard } from "./PMPMRKpiCard";
import { Plus, Loader2, TrendingUp, Wallet, Clock, FileUp, Banknote } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function ContasAReceber() {
  const { entries, totals, isLoading, create, update, markAsPaid, undoPaymentIssued, remove } = useFinanceiro("entrada");
  const duplicates = useDuplicateDetection(entries);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editEntry, setEditEntry] = useState<FinanceiroEntry | null>(null);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  const buildInitial = (e: FinanceiroEntry): Partial<FinanceiroInput> => ({
    tipo: "entrada",
    descricao: e.descricao,
    valor_previsto: Number(e.valor_previsto),
    valor_realizado: e.valor_realizado != null ? Number(e.valor_realizado) : null,
    data_prevista: e.data_prevista,
    data_realizada: e.data_realizada,
    status: e.status,
    account_id: e.account_id,
    cost_center_id: e.cost_center_id,
    entity_id: e.entity_id,
    notes: e.notes,
    documento: (e as any).documento ?? null,
    tipo_documento: (e as any).tipo_documento ?? null,
    tipo_despesa: (e as any).tipo_despesa ?? null,
    subcategoria_id: (e as any).subcategoria_id ?? null,
    valor_bruto: Number((e as any).valor_bruto ?? e.valor_previsto ?? 0),
    valor_desconto: Number((e as any).valor_desconto ?? 0),
    valor_juros_multa: Number((e as any).valor_juros_multa ?? 0),
    competencia: (e as any).competencia ?? null,
    data_vencimento: (e as any).data_vencimento ?? e.data_prevista ?? null,
    data_prevista_pagamento: (e as any).data_prevista_pagamento ?? null,
    natureza_contabil: (e as any).natureza_contabil ?? null,
    impacto_fluxo_caixa: (e as any).impacto_fluxo_caixa ?? true,
    impacto_orcamento: (e as any).impacto_orcamento ?? true,
    afeta_caixa_no_vencimento: (e as any).afeta_caixa_no_vencimento ?? true,
    conta_contabil_ref: (e as any).conta_contabil_ref ?? null,
    forma_pagamento: (e as any).forma_pagamento ?? null,
    conta_bancaria_id: (e as any).conta_bancaria_id ?? null,
    num_parcelas: (e as any).num_parcelas ?? null,
    recorrencia: (e as any).recorrencia ?? null,
    data_assinatura: (e as any).data_assinatura ?? null,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Previsto" value={`${fmt(totals.pendente)} (${totals.count_pendente})`} icon={<Clock size={20} />} />
        <KPICard title="Recebimento esperado" value={`${fmt(totals.em_pagamento)} (${totals.count_em_pagamento})`} icon={<Banknote size={20} />} />
        <KPICard title="Recebido (conciliado)" value={fmt(totals.total_realizado)} icon={<Wallet size={20} />} />
        <PMPMRKpiCard tipo="entrada" />
      </div>

      <DuplicateAlerts duplicates={duplicates} onDelete={(id) => remove.mutate(id)} />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
          <FileUp className="h-4 w-4 mr-1" /> Importar CSV/XLSX
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Receita
        </Button>
      </div>

      <FinanceiroTable
        entries={entries}
        tipo="entrada"
        onMarkAsPaid={(data) => markAsPaid.mutate(data)}
        onUndoIssued={(id) => undoPaymentIssued.mutate(id)}
        onDelete={(id) => remove.mutate(id)}
        onEdit={(e) => setEditEntry(e)}
        isDeleting={remove.isPending}
      />

      <FinanceiroEntryDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        tipo="entrada"
        onSave={async (input) => { await create.mutateAsync(input); }}
        isPending={create.isPending}
      />

      {editEntry && (
        <FinanceiroEntryDialog
          open={!!editEntry}
          onOpenChange={(o) => { if (!o) setEditEntry(null); }}
          tipo="entrada"
          editMode
          initial={buildInitial(editEntry)}
          onSave={async (input) => {
            await update.mutateAsync({ id: editEntry.id, ...input });
            setEditEntry(null);
          }}
          isPending={update.isPending}
        />
      )}

      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        tipo="entrada"
      />
    </div>
  );
}
