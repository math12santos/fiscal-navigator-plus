import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { useContracts, Contract } from "@/hooks/useContracts";
import { useContractAdjustments } from "@/hooks/useContractAdjustments";
import { useContractDocuments } from "@/hooks/useContractDocuments";
import ContractFormDialog, { ContractFormData } from "@/components/ContractFormDialog";
import { cn } from "@/lib/utils";
import {
  FileText, AlertTriangle, CheckCircle, Plus, Pencil, Trash2, Loader2,
  Cloud, X, CalendarIcon, Eye, Upload, TrendingUp, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const recorrenciaLabel: Record<string, string> = {
  mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral",
  semestral: "Semestral", anual: "Anual", personalizado: "Personalizado",
};

function contractToFormData(c: Contract): ContractFormData {
  return {
    nome: c.nome, tipo: c.tipo, valor: Number(c.valor), vencimento: c.vencimento,
    status: c.status, notes: c.notes ?? "",
    tipo_recorrencia: c.tipo_recorrencia ?? "mensal",
    intervalo_personalizado: c.intervalo_personalizado ?? null,
    data_inicio: c.data_inicio ?? "", data_fim: c.data_fim ?? "",
    prazo_indeterminado: c.prazo_indeterminado ?? false,
    valor_base: Number(c.valor_base ?? 0),
    dia_vencimento: c.dia_vencimento ?? null,
    tipo_reajuste: c.tipo_reajuste ?? "manual",
    indice_reajuste: c.indice_reajuste ?? "",
    percentual_reajuste: c.percentual_reajuste ?? null,
    periodicidade_reajuste: c.periodicidade_reajuste ?? "anual",
    proximo_reajuste: c.proximo_reajuste ?? "",
    natureza_financeira: c.natureza_financeira ?? "fixo",
    impacto_resultado: c.impacto_resultado ?? "custo",
    cost_center_id: c.cost_center_id ?? "",
    responsavel_interno: c.responsavel_interno ?? "",
    area_responsavel: c.area_responsavel ?? "",
    sla_revisao_dias: c.sla_revisao_dias ?? null,
  };
}

// ==================== CONTRACT DETAIL ====================
function ContractDetail({ contract, onBack, onEdit }: { contract: Contract; onBack: () => void; onEdit: () => void }) {
  const { adjustments, isLoading: adjLoading, create: createAdj } = useContractAdjustments(contract.id);
  const { documents, isLoading: docLoading, upload, remove: removeDoc } = useContractDocuments(contract.id);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ percentual: 0, observacao: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState("contrato");

  const handleNewAdj = () => {
    createAdj.mutate({
      contract_id: contract.id,
      data_reajuste: new Date().toISOString().split("T")[0],
      tipo: contract.tipo_reajuste ?? "manual",
      indice_aplicado: contract.indice_reajuste ?? null,
      percentual: adjForm.percentual,
      valor_anterior: Number(contract.valor),
      valor_novo: Number(contract.valor) * (1 + adjForm.percentual / 100),
      observacao: adjForm.observacao || null,
    }, { onSuccess: () => { setAdjOpen(false); setAdjForm({ percentual: 0, observacao: "" }); } });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file, fileType: uploadType });
    e.target.value = "";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft size={18} /></Button>
        <PageHeader title={contract.nome} description={`${contract.tipo} • ${recorrenciaLabel[contract.tipo_recorrencia] ?? contract.tipo_recorrencia}`} />
        <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={onEdit}><Pencil size={14} /> Editar</Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Mensal</p>
          <p className="text-xl font-bold text-primary mt-1">{fmt(Number(contract.valor))}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Base</p>
          <p className="text-xl font-bold text-foreground mt-1">{fmt(Number(contract.valor_base))}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
          <p className="text-xl font-bold mt-1">{contract.status}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Natureza</p>
          <p className="text-xl font-bold mt-1 capitalize">{contract.natureza_financeira ?? "—"}</p>
        </div>
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Recorrência</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>Tipo: <span className="text-foreground">{recorrenciaLabel[contract.tipo_recorrencia] ?? "—"}</span></p>
            <p>Início: <span className="text-foreground">{contract.data_inicio ? new Date(contract.data_inicio).toLocaleDateString("pt-BR") : "—"}</span></p>
            <p>Término: <span className="text-foreground">{contract.prazo_indeterminado ? "Indeterminado" : contract.data_fim ? new Date(contract.data_fim).toLocaleDateString("pt-BR") : "—"}</span></p>
          </div>
        </div>
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Governança</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>Responsável: <span className="text-foreground">{contract.responsavel_interno || "—"}</span></p>
            <p>Área: <span className="text-foreground">{contract.area_responsavel || "—"}</span></p>
            <p>SLA revisão: <span className="text-foreground">{contract.sla_revisao_dias ? `${contract.sla_revisao_dias} dias` : "—"}</span></p>
          </div>
        </div>
      </div>

      {/* Reajustes */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><TrendingUp size={16} /> Histórico de Reajustes</h3>
          <Button size="sm" variant="outline" onClick={() => setAdjOpen(true)}>Novo Reajuste</Button>
        </div>
        {adjLoading ? <Loader2 className="animate-spin text-primary" size={20} /> : adjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum reajuste registrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Data</th>
                <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">%</th>
                <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Anterior</th>
                <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Novo</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Obs</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((a) => (
                <tr key={a.id} className="border-b border-border/30">
                  <td className="px-3 py-2">{new Date(a.data_reajuste).toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right font-mono">{a.percentual}%</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(a.valor_anterior)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(a.valor_novo)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.observacao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documentos */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><FileText size={16} /> Documentos</h3>
          <div className="flex items-center gap-2">
            <Select value={uploadType} onValueChange={setUploadType}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contrato">Contrato</SelectItem>
                <SelectItem value="aditivo">Aditivo</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1">
              <Upload size={14} /> Upload
            </Button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          </div>
        </div>
        {docLoading ? <Loader2 className="animate-spin text-primary" size={20} /> : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-primary" />
                  <span className="text-sm">{d.file_name}</span>
                  <Badge variant="outline" className="text-xs">{d.file_type} v{d.version}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" asChild><a href={d.file_url} target="_blank" rel="noopener"><Eye size={14} /></a></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeDoc.mutate(d.id)} className="text-destructive"><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adj Dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Reajuste</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Percentual (%)</Label>
              <Input type="number" step={0.01} value={adjForm.percentual} onChange={(e) => setAdjForm({ ...adjForm, percentual: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Valor atual: {fmt(Number(contract.valor))}</Label>
              <p className="text-sm text-muted-foreground">Novo valor: {fmt(Number(contract.valor) * (1 + adjForm.percentual / 100))}</p>
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea value={adjForm.observacao} onChange={(e) => setAdjForm({ ...adjForm, observacao: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleNewAdj} disabled={createAdj.isPending} className="w-full">
              {createAdj.isPending ? "Salvando..." : "Registrar Reajuste"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== CONTRACT LIST (main) ====================
export default function Contratos() {
  const { contracts, isLoading, create, update, remove } = useContracts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Contract | null>(null);

  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const tipos = useMemo(() => [...new Set(contracts.map((c) => c.tipo))], [contracts]);
  const statuses = useMemo(() => [...new Set(contracts.map((c) => c.status))], [contracts]);

  const filtered = useMemo(() => contracts.filter((c) => {
    if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (dateFrom && new Date(c.vencimento) < dateFrom) return false;
    if (dateTo && new Date(c.vencimento) > dateTo) return false;
    return true;
  }), [contracts, filterTipo, filterStatus, dateFrom, dateTo]);

  const hasFilters = filterTipo !== "all" || filterStatus !== "all" || !!dateFrom || !!dateTo;
  const clearFilters = () => { setFilterTipo("all"); setFilterStatus("all"); setDateFrom(undefined); setDateTo(undefined); };

  const activeContracts = filtered.filter((c) => c.status === "Ativo");
  const totalValue = filtered.reduce((sum, c) => sum + Number(c.valor), 0);
  const nextExpiry = filtered.length
    ? filtered.reduce((min, c) => (c.vencimento < min ? c.vencimento : min), filtered[0].vencimento)
    : null;

  const handleSubmit = (data: ContractFormData) => {
    if (editing) {
      update.mutate({ id: editing.id, ...data } as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
    } else {
      create.mutate(data as any, { onSuccess: () => setFormOpen(false) });
    }
  };

  const openEdit = (c: Contract) => { setEditing(c); setFormOpen(true); };
  const openCreate = () => { setEditing(null); setFormOpen(true); };

  // Detail view
  if (viewing) {
    return (
      <>
        <ContractDetail
          contract={viewing}
          onBack={() => setViewing(null)}
          onEdit={() => { openEdit(viewing); }}
        />
        <ContractFormDialog
          open={formOpen}
          onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
          onSubmit={(data) => {
            update.mutate({ id: viewing.id, ...data } as any, {
              onSuccess: () => {
                setFormOpen(false);
                setEditing(null);
                // refresh viewing data
                const updated = contracts.find((c) => c.id === viewing.id);
                if (updated) setViewing({ ...updated, ...data } as any);
              },
            });
          }}
          initialData={contractToFormData(viewing)}
          loading={update.isPending}
        />
      </>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <PageHeader title="Gestão de Contratos" description="Cadastro e acompanhamento de contratos financeiros e operacionais" />
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Novo Contrato</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contratos Ativos</p>
          <p className="text-2xl font-bold text-foreground mt-1">{activeContracts.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Total Mensal</p>
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
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground"><X size={14} /> Limpar</Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} de {contracts.length} contratos</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
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
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recorrência</th>
                <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Mensal</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setViewing(c)}>
                  <td className="px-5 py-3.5 flex items-center gap-2">
                    <FileText size={16} className="text-primary" />
                    <span className="font-medium text-foreground">{c.nome}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.tipo}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{recorrenciaLabel[c.tipo_recorrencia] ?? c.tipo_recorrencia}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-foreground">{fmt(Number(c.valor))}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                      c.status === "Ativo" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    )}>
                      {c.status === "Ativo" ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(c)}><Eye size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
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
        initialData={editing ? contractToFormData(editing) : null}
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
            <AlertDialogAction onClick={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
