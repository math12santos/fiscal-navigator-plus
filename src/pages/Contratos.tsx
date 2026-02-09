import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useContracts, Contract } from "@/hooks/useContracts";
import ContractFormDialog, { ContractFormData } from "@/components/ContractFormDialog";
import { cn } from "@/lib/utils";
import { FileText, AlertTriangle, CheckCircle, Plus, Pencil, Trash2, Loader2, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export default function Contratos() {
  const { contracts, isLoading, create, update, remove } = useContracts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const activeContracts = contracts.filter((c) => c.status === "Ativo");
  const totalValue = contracts.reduce((sum, c) => sum + Number(c.valor), 0);
  const nextExpiry = contracts.length
    ? contracts.reduce((min, c) => (c.vencimento < min ? c.vencimento : min), contracts[0].vencimento)
    : null;

  const handleSubmit = (data: ContractFormData) => {
    if (editing) {
      update.mutate({ id: editing.id, ...data }, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
    } else {
      create.mutate(data as any, { onSuccess: () => setFormOpen(false) });
    }
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <PageHeader title="Gestão de Contratos" description="Cadastro e acompanhamento de contratos financeiros e operacionais" />
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} /> Novo Contrato
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contratos Ativos</p>
          <p className="text-2xl font-bold text-foreground mt-1">{activeContracts.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-bold text-primary mt-1">{fmt(totalValue)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Próx. Vencimento</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {nextExpiry ? new Date(nextExpiry).toLocaleDateString("pt-BR") : "—"}
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-3 opacity-40" />
            <p>Nenhum contrato cadastrado.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>Cadastrar primeiro contrato</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Contrato</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo</th>
                <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Mensal</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Origem</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5 flex items-center gap-2">
                    <FileText size={16} className="text-primary" />
                    <span className="font-medium text-foreground">{c.nome}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.tipo}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-foreground">{fmt(Number(c.valor))}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={c.source === "manual" ? "secondary" : "outline"} className="text-xs gap-1">
                      {c.source === "manual" ? <Pencil size={10} /> : <Cloud size={10} />}
                      {c.source === "manual" ? "Manual" : "ERP"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                      c.status === "Ativo" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    )}>
                      {c.status === "Ativo" ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="text-destructive hover:text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ContractFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing ? { nome: editing.nome, tipo: editing.tipo, valor: Number(editing.valor), vencimento: editing.vencimento, status: editing.status, notes: editing.notes ?? "" } : null}
        loading={create.isPending || update.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
