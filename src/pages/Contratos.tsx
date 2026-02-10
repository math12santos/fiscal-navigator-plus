import { useState, useMemo, useRef, useCallback } from "react";
import { format, startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear, differenceInDays, differenceInMonths, subMonths, max, min } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { useContracts, Contract } from "@/hooks/useContracts";
import { useProducts } from "@/hooks/useProducts";
import { useContractAdjustments } from "@/hooks/useContractAdjustments";
import { useContractDocuments } from "@/hooks/useContractDocuments";
import ContractFormDialog, { ContractFormData } from "@/components/ContractFormDialog";
import { cn } from "@/lib/utils";
import {
  FileText, AlertTriangle, CheckCircle, Plus, Pencil, Trash2, Loader2,
  Cloud, X, CalendarIcon, Eye, Upload, TrendingUp, ChevronLeft, ChevronRight, Clock,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const recorrenciaLabel: Record<string, string> = {
  unico: "Único", mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral",
  semestral: "Semestral", anual: "Anual", personalizado: "Personalizado",
};

// Date cycle presets
type DateCycle = "todos" | "mensal" | "bimestral" | "trimestral" | "semestral" | "anual" | "personalizado";
const dateCycleLabels: Record<DateCycle, string> = {
  todos: "Todos", mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral",
  semestral: "Semestral", anual: "Anual", personalizado: "Personalizado",
};

function getCycleDates(cycle: DateCycle, ref: Date = new Date()): { from: Date; to: Date } | null {
  if (cycle === "personalizado" || cycle === "todos") return null;
  const start = startOfMonth(ref);
  const monthsMap: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
  const months = monthsMap[cycle] ?? 1;
  return { from: start, to: endOfMonth(addMonths(start, months - 1)) };
}

function getCycleLabel(cycle: DateCycle, ref: Date): string {
  const monthsMap: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
  const months = monthsMap[cycle] ?? 1;
  const from = startOfMonth(ref);
  const to = endOfMonth(addMonths(from, months - 1));
  if (months === 1) return format(from, "MMMM yyyy", { locale: ptBR });
  return `${format(from, "MMM/yy", { locale: ptBR })} – ${format(to, "MMM/yy", { locale: ptBR })}`;
}
/**
 * Calculate the projected financial value of a contract within a date range.
 * For recurring contracts, multiplies the monthly value by the number of months
 * the contract is active within the period.
 * For unique (one-time) contracts, returns the contract value if active in range.
 */
function getProjectedValue(c: Contract, from?: Date, to?: Date): number {
  const valor = Number(c.valor);
  if (!from || !to) return valor; // no period filter = show face value

  const contractStart = c.data_inicio ? new Date(c.data_inicio) : new Date(c.created_at);
  const contractEnd = c.data_fim ? new Date(c.data_fim) : (c.prazo_indeterminado ? null : new Date(c.vencimento));

  // Effective overlap period
  const effectiveStart = max([contractStart, from]);
  const effectiveEnd = contractEnd ? min([contractEnd, to]) : to;

  if (effectiveStart > effectiveEnd) return 0;

  if (c.tipo_recorrencia === "unico") return valor;

  // For recurring contracts, calculate how many months fall within the overlap
  const recurrenceMonths: Record<string, number> = {
    mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
  };
  const interval = recurrenceMonths[c.tipo_recorrencia] ?? 1;
  const totalMonthsInRange = differenceInMonths(endOfMonth(effectiveEnd), startOfMonth(effectiveStart)) + 1;
  const occurrences = Math.max(1, Math.floor(totalMonthsInRange / interval));

  return valor * occurrences;
}

// Smart status classification
function classifyContractStatus(c: Contract): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(c.vencimento);
  venc.setHours(0, 0, 0, 0);

  if (c.status !== "Ativo") return c.status;
  const daysUntil = differenceInDays(venc, today);
  if (daysUntil < 0) return "Vencido";
  if (daysUntil <= 30) return "Próx. Vencimento";
  return "Ativo";
}

function contractToFormData(c: Contract): ContractFormData {
  return {
    nome: c.nome, entity_id: (c as any).entity_id ?? "", product_id: (c as any).product_id ?? "", tipo: c.tipo, valor: Number(c.valor), vencimento: c.vencimento,
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
    finalidade: c.finalidade ?? "",
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
  const { products } = useProducts();
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Contract | null>(null);

  // Filters
  const [filterTipo, setFilterTipo] = useState("all"); // all | Produto | Serviço
  const [filterStatus, setFilterStatus] = useState("all"); // all | Ativo | Vencido | Próx. Vencimento | Cancelado | Suspenso
  const [dateCycle, setDateCycle] = useState<DateCycle>("todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  // When cycle changes, update dates
  const handleCycleChange = (cycle: DateCycle) => {
    setDateCycle(cycle);
    if (cycle === "todos") {
      setDateFrom(undefined);
      setDateTo(undefined);
    } else if (cycle === "personalizado") {
      // keep current from/to
    } else {
      const dates = getCycleDates(cycle, referenceDate);
      if (dates) { setDateFrom(dates.from); setDateTo(dates.to); }
    }
  };

  const navigatePeriod = (direction: 1 | -1) => {
    const monthsMap: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
    const months = monthsMap[dateCycle] ?? 1;
    const newRef = direction === 1 ? addMonths(referenceDate, months) : subMonths(referenceDate, months);
    setReferenceDate(newRef);
    const dates = getCycleDates(dateCycle, newRef);
    if (dates) { setDateFrom(dates.from); setDateTo(dates.to); }
  };

  // Derive smart statuses for each contract
  const contractsWithStatus = useMemo(() =>
    contracts.map((c) => ({ ...c, displayStatus: classifyContractStatus(c) })),
    [contracts]
  );

  // All unique raw + smart statuses
  const statusOptions = ["Ativo", "Vencido", "Próx. Vencimento", "Cancelado", "Suspenso"];

  const filtered = useMemo(() => contractsWithStatus.filter((c) => {
    // Type filter: Produto or Serviço
    if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
    // Status filter using smart status
    if (filterStatus !== "all" && c.displayStatus !== filterStatus) return false;
    // Date range filter: contract must be active during the selected period
    if (dateFrom || dateTo) {
      const contractStart = c.data_inicio ? new Date(c.data_inicio) : new Date(c.created_at);
      const contractEnd = c.data_fim ? new Date(c.data_fim) : (c.prazo_indeterminado ? null : new Date(c.vencimento));
      // A contract is visible if its active range overlaps the filter range
      // overlap = contractStart <= dateTo AND (contractEnd >= dateFrom OR no end date)
      if (dateTo && contractStart > dateTo) return false;
      if (dateFrom && contractEnd && contractEnd < dateFrom) return false;
    }
    return true;
  }), [contractsWithStatus, filterTipo, filterStatus, dateFrom, dateTo]);

  const hasFilters = filterTipo !== "all" || filterStatus !== "all" || dateCycle !== "todos";
  const clearFilters = () => {
    setFilterTipo("all");
    setFilterStatus("all");
    handleCycleChange("todos");
  };

  // KPI calculations based on filtered data
  const activeCount = filtered.filter((c) => c.displayStatus === "Ativo").length;
  const overdueCount = filtered.filter((c) => c.displayStatus === "Vencido").length;
  const nearExpiryCount = filtered.filter((c) => c.displayStatus === "Próx. Vencimento").length;
  const totalReceita = filtered
    .filter((c) => c.impacto_resultado === "receita")
    .reduce((sum, c) => sum + getProjectedValue(c, dateFrom, dateTo), 0);
  const totalGasto = filtered
    .filter((c) => c.impacto_resultado && ["custo", "despesa"].includes(c.impacto_resultado))
    .reduce((sum, c) => sum + getProjectedValue(c, dateFrom, dateTo), 0);
  const totalInvestimento = filtered
    .filter((c) => c.impacto_resultado && ["investimento", "ativo_imobilizado"].includes(c.impacto_resultado))
    .reduce((sum, c) => sum + getProjectedValue(c, dateFrom, dateTo), 0);

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
                const updated = contracts.find((c) => c.id === viewing.id);
                if (updated) setViewing({ ...updated, ...data } as any);
              },
            });
          }}
          initialData={contractToFormData(viewing)}
          loading={update.isPending}
          contractId={viewing.id}
        />
      </>
    );
  }

  const periodLabel = dateFrom && dateTo
    ? `${format(dateFrom, "dd/MM/yy")} – ${format(dateTo, "dd/MM/yy")}`
    : "";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <PageHeader title="Gestão de Contratos" description="Cadastro e acompanhamento de contratos financeiros e operacionais" />
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Novo Contrato</Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="Produto">Produto</SelectItem>
            <SelectItem value="Serviço">Serviço</SelectItem>
            <SelectItem value="Imobilizado">Imobilizado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dateCycle} onValueChange={(v) => handleCycleChange(v as DateCycle)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {(Object.keys(dateCycleLabels) as DateCycle[]).map((k) => (
              <SelectItem key={k} value={k}>{dateCycleLabels[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateCycle !== "todos" && dateCycle !== "personalizado" && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod(-1)}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">
              {getCycleLabel(dateCycle, referenceDate)}
            </span>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod(1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
        {dateCycle === "personalizado" && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </>
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground"><X size={14} /> Limpar</Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {contracts.length} contratos
          {periodLabel && <span className="ml-2 text-primary">• {periodLabel}</span>}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-success" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ativos</p>
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{activeCount}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-destructive" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencidos</p>
          </div>
          <p className="text-2xl font-bold text-destructive mt-1">{overdueCount}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-warning" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Próx. Vencimento</p>
          </div>
          <p className="text-2xl font-bold text-warning mt-1">{nearExpiryCount}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-success" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Receita no Período</p>
          </div>
          <p className="text-2xl font-bold text-success mt-1">{fmt(totalReceita)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-destructive rotate-180" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gastos no Período</p>
          </div>
          <p className="text-2xl font-bold text-destructive mt-1">{fmt(totalGasto)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Investimentos</p>
          </div>
          <p className="text-2xl font-bold text-primary mt-1">{fmt(totalInvestimento)}</p>
        </div>
      </div>

      {/* Tabbed Table */}
      <Tabs defaultValue="todos" className="space-y-0">
        <TabsList className="mb-4">
          <TabsTrigger value="todos">Todos ({filtered.length})</TabsTrigger>
          <TabsTrigger value="gastos">Gastos ({filtered.filter(c => c.impacto_resultado && ["custo", "despesa"].includes(c.impacto_resultado)).length})</TabsTrigger>
          <TabsTrigger value="receita">Receita ({filtered.filter(c => c.impacto_resultado === "receita").length})</TabsTrigger>
          <TabsTrigger value="investimentos">Investimentos ({filtered.filter(c => c.impacto_resultado && ["investimento", "ativo_imobilizado"].includes(c.impacto_resultado)).length})</TabsTrigger>
        </TabsList>
        {(["todos", "gastos", "receita", "investimentos"] as const).map((tab) => {
          const tabData = tab === "todos" ? filtered
            : tab === "gastos" ? filtered.filter(c => c.impacto_resultado && ["custo", "despesa"].includes(c.impacto_resultado))
            : tab === "investimentos" ? filtered.filter(c => c.impacto_resultado && ["investimento", "ativo_imobilizado"].includes(c.impacto_resultado))
            : filtered.filter(c => c.impacto_resultado === "receita");
          return (
            <TabsContent key={tab} value={tab}>
              <div className="glass-card overflow-hidden">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
                ) : tabData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText size={40} className="mx-auto mb-3 opacity-40" />
                    <p>{contracts.length === 0 ? "Nenhum contrato cadastrado." : "Nenhum contrato encontrado."}</p>
                    {contracts.length === 0 && <Button variant="outline" className="mt-4" onClick={openCreate}>Cadastrar primeiro contrato</Button>}
                    {hasFilters && <Button variant="outline" className="mt-4" onClick={clearFilters}>Limpar filtros</Button>}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Contrato</th>
                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Produto/Serviço</th>
                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recorrência</th>
                        <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Mensal</th>
                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento</th>
                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabData.map((c) => (
                        <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setViewing(c)}>
                          <td className="px-5 py-3.5 flex items-center gap-2">
                            <FileText size={16} className="text-primary" />
                            <span className="font-medium text-foreground">{c.nome}</span>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">{productMap.get((c as any).product_id)?.name ?? c.tipo}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{recorrenciaLabel[c.tipo_recorrencia] ?? c.tipo_recorrencia}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-foreground">{fmt(Number(c.valor))}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                              c.displayStatus === "Ativo" ? "bg-success/10 text-success" :
                              c.displayStatus === "Vencido" ? "bg-destructive/10 text-destructive" :
                              c.displayStatus === "Próx. Vencimento" ? "bg-warning/10 text-warning" :
                              "bg-muted/50 text-muted-foreground"
                            )}>
                              {c.displayStatus === "Ativo" ? <CheckCircle size={12} /> :
                               c.displayStatus === "Vencido" ? <AlertTriangle size={12} /> :
                               c.displayStatus === "Próx. Vencimento" ? <Clock size={12} /> :
                               <AlertTriangle size={12} />}
                              {c.displayStatus}
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
            </TabsContent>
          );
        })}
      </Tabs>

      <ContractFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing ? contractToFormData(editing) : null}
        loading={create.isPending || update.isPending}
        contractId={editing?.id ?? null}
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
