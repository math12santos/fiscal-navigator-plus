import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLiabilities, Liability, LiabilityInput } from "@/hooks/useLiabilities";
import { useEntities } from "@/hooks/useEntities";
import { useContracts } from "@/hooks/useContracts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Trash2, AlertTriangle, TrendingDown, Shield, Scale } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const tipoLabels: Record<string, string> = { divida: "Dívida", contingencia: "Contingência", provisao: "Provisão" };
const statusLabels: Record<string, string> = { ativo: "Ativo", quitado: "Quitado", negociacao: "Negociação", judicial: "Judicial" };
const probLabels: Record<string, string> = { provavel: "Provável", possivel: "Possível", remota: "Remota" };
const probColors: Record<string, string> = { provavel: "destructive", possivel: "default", remota: "secondary" };

const emptyForm: LiabilityInput = {
  name: "",
  tipo: "divida",
  descricao: null,
  valor_original: 0,
  valor_atualizado: 0,
  taxa_juros: 0,
  data_inicio: null,
  data_vencimento: null,
  status: "ativo",
  probabilidade: "provavel",
  impacto_stress: 0,
  entity_id: null,
  contract_id: null,
  cost_center_id: null,
  notes: null,
};

export default function PlanningLiabilities() {
  const { liabilities, isLoading, totals, create, update, remove } = useLiabilities();
  const { entities } = useEntities();
  const { contracts } = useContracts();
  const { costCenters } = useCostCenters();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<LiabilityInput>(emptyForm);
  const [filterTipo, setFilterTipo] = useState<string>("todos");

  const filtered = useMemo(
    () => filterTipo === "todos" ? liabilities : liabilities.filter(l => l.tipo === filterTipo),
    [liabilities, filterTipo]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (l: Liability) => {
    setEditingId(l.id);
    setForm({
      name: l.name,
      tipo: l.tipo,
      descricao: l.descricao,
      valor_original: l.valor_original,
      valor_atualizado: l.valor_atualizado,
      taxa_juros: l.taxa_juros,
      data_inicio: l.data_inicio,
      data_vencimento: l.data_vencimento,
      status: l.status,
      probabilidade: l.probabilidade,
      impacto_stress: l.impacto_stress,
      entity_id: l.entity_id,
      contract_id: l.contract_id,
      cost_center_id: l.cost_center_id,
      notes: l.notes,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (editingId) {
      await update.mutateAsync({ id: editingId, ...form });
    } else {
      await create.mutateAsync(form);
    }
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await remove.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Passivos" value={fmt(totals.total)} icon={<TrendingDown size={20} />} />
        <KPICard title="Dívidas" value={fmt(totals.dividas)} icon={<AlertTriangle size={20} />} />
        <KPICard title="Contingências (Prováveis)" value={fmt(totals.contingencias_provaveis)} icon={<Scale size={20} />} />
        <KPICard title="Exposição Stress" value={fmt(totals.stress_total)} icon={<Shield size={20} />} />
      </div>

      {/* Filter + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="divida">Dívidas</SelectItem>
            <SelectItem value="contingencia">Contingências</SelectItem>
            <SelectItem value="provisao">Provisões</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} registros</Badge>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo Passivo
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <TrendingDown className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum passivo registrado.</p>
        </div>
      ) : (
        <div className="glass-card overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead className="text-right">Valor Atualizado</TableHead>
                <TableHead className="text-right">Stress (+%)</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(l)}>
                  <TableCell className="font-medium text-sm">{l.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{tipoLabels[l.tipo] ?? l.tipo}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.status === "quitado" ? "secondary" : "default"} className="text-xs">
                      {statusLabels[l.status] ?? l.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.tipo === "contingencia" && (
                      <Badge variant={probColors[l.probabilidade] as any ?? "default"} className="text-xs">
                        {probLabels[l.probabilidade] ?? l.probabilidade}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(l.valor_atualizado))}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {l.impacto_stress > 0 ? `+${l.impacto_stress}%` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.data_vencimento ? format(new Date(l.data_vencimento), "dd/MM/yy", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(l.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Passivo" : "Novo Passivo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Empréstimo Bancário" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="divida">Dívida</SelectItem>
                    <SelectItem value="contingencia">Contingência</SelectItem>
                    <SelectItem value="provisao">Provisão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="negociacao">Negociação</SelectItem>
                    <SelectItem value="judicial">Judicial</SelectItem>
                    <SelectItem value="quitado">Quitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.tipo === "contingencia" && (
              <div className="space-y-2">
                <Label>Probabilidade</Label>
                <Select value={form.probabilidade} onValueChange={(v) => setForm({ ...form, probabilidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provavel">Provável</SelectItem>
                    <SelectItem value="possivel">Possível</SelectItem>
                    <SelectItem value="remota">Remota</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor Original (R$)</Label>
                <Input type="number" value={form.valor_original} onChange={(e) => setForm({ ...form, valor_original: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Valor Atualizado (R$)</Label>
                <Input type="number" value={form.valor_atualizado} onChange={(e) => setForm({ ...form, valor_atualizado: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Taxa de Juros (%)</Label>
                <Input type="number" value={form.taxa_juros} onChange={(e) => setForm({ ...form, taxa_juros: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Impacto Stress (%)</Label>
                <Input type="number" value={form.impacto_stress} onChange={(e) => setForm({ ...form, impacto_stress: Number(e.target.value) })} placeholder="Variação adicional sob stress" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Data Vencimento</Label>
                <Input type="date" value={form.data_vencimento ?? ""} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value || null })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entidade</Label>
              <Select value={form.entity_id ?? "none"} onValueChange={(v) => setForm({ ...form, entity_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {entities.filter(e => e.active).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={form.cost_center_id ?? "none"} onValueChange={(v) => setForm({ ...form, cost_center_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {costCenters.filter(c => c.active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value || null })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir passivo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
