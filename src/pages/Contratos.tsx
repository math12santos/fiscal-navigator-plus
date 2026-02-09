import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { useContracts, Contract } from "@/hooks/useContracts";
import ContractFormDialog, { ContractFormData } from "@/components/ContractFormDialog";
import { cn } from "@/lib/utils";
import { FileText, AlertTriangle, CheckCircle, Plus, Pencil, Trash2, Loader2, Cloud, X, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

  // Filters
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const tipos = useMemo(() => [...new Set(contracts.map((c) => c.tipo))], [contracts]);
  const statuses = useMemo(() => [...new Set(contracts.map((c) => c.status))], [contracts]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (dateFrom && new Date(c.vencimento) < dateFrom) return false;
      if (dateTo && new Date(c.vencimento) > dateTo) return false;
      return true;
    });
  }, [contracts, filterTipo, filterStatus, dateFrom, dateTo]);

  const hasFilters = filterTipo !== "all" || filterStatus !== "all" || !!dateFrom || !!dateTo;
  const clearFilters = () => { setFilterTipo("all"); setFilterStatus("all"); setDateFrom(undefined); setDateTo(undefined); };

  const activeContracts = filtered.filter((c) => c.status === "Ativo");
  const totalValue = filtered.reduce((sum, c) => sum + Number(c.valor), 0);
  const nextExpiry = filtered.length
    ? filtered.reduce((min, c) => (c.vencimento < min ? c.vencimento : min), filtered[0].vencimento)
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

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X size={14} /> Limpar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {contracts.length} contratos
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-3 opacity-40" />
            <p>{contracts.length === 0 ? "Nenhum contrato cadastrado." : "Nenhum contrato encontrado com os filtros aplicados."}</p>
            {contracts.length === 0 && <Button variant="outline" className="mt-4" onClick={openCreate}>Cadastrar primeiro contrato</Button>}
            {hasFilters && <Button variant="outline" className="mt-4" onClick={clearFilters}>Limpar filtros</Button>}
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
              {filtered.map((c) => (
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
