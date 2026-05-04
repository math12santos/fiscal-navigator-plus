import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard } from "@/components/SectionCard";
import { Inbox, CheckCircle2, XCircle, Clock, Eye, Check, X, Edit2, Trash2, Plus, ListChecks, FileText } from "lucide-react";
import { useRequests, useUpdateRequest } from "@/hooks/useRequests";
import { useExpensePolicies } from "@/hooks/useExpensePolicies";
import { useRequestSlas } from "@/hooks/useRequestSlas";
import { useToast } from "@/hooks/use-toast";
import { ApproveRequestDialog } from "./ApproveRequestDialog";
import { RequestDetailDrawer } from "./RequestDetailDrawer";
import { parseRequestDescription } from "@/lib/requestDescription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const MODULES = [
  { value: "dp", label: "DP" },
  { value: "juridico", label: "Jurídico" },
  { value: "ti", label: "TI" },
  { value: "crm", label: "Comercial" },
  { value: "financeiro", label: "Financeiro" },
  { value: "cadastros", label: "Compras" },
];

const PRIORITIES = ["baixa", "media", "alta", "urgente"];

const priorityColors: Record<string, string> = {
  urgente: "destructive",
  alta: "destructive",
  media: "secondary",
  baixa: "outline",
};

const moduleColors: Record<string, string> = {
  dp: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  juridico: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  ti: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  crm: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  financeiro: "bg-primary/10 text-primary border-primary/30",
  cadastros: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

const fmt = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function SolicitacoesTab() {
  const { data: allRequests = [] } = useRequests({ type: "expense_request" });
  const updateRequest = useUpdateRequest();
  const { toast } = useToast();

  const [subTab, setSubTab] = useState("pendentes");
  const [filterModule, setFilterModule] = useState<string>("__all__");
  const [filterSubtype, setFilterSubtype] = useState<string>("__all__");

  const [approveOpen, setApproveOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = useMemo(() => {
    return allRequests.filter((r: any) => {
      const parsed = parseRequestDescription(r.description);
      if (filterModule !== "__all__" && r.reference_module !== filterModule) return false;
      if (filterSubtype !== "__all__" && parsed.subtype !== filterSubtype) return false;
      return true;
    });
  }, [allRequests, filterModule, filterSubtype]);

  const pendentes = filtered.filter((r: any) => r.status === "aberta" || r.status === "em_revisao");
  const aprovadas = filtered.filter((r: any) => r.status === "aprovada");
  const rejeitadas = filtered.filter((r: any) => r.status === "rejeitada");

  const handleApprove = (req: any) => {
    setSelected(req);
    setApproveOpen(true);
  };

  const handleViewDetail = (req: any) => {
    setSelected(req);
    setDetailOpen(true);
  };

  const handleRejectClick = (req: any) => {
    setSelected(req);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!selected || !rejectReason.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }
    try {
      await updateRequest.mutateAsync({
        id: selected.id,
        status: "rejeitada",
        justificativa: rejectReason,
      });
      toast({ title: "Solicitação rejeitada" });
      setRejectOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* KPIs rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KpiSmall icon={Clock} label="Pendentes" value={pendentes.length} tone="warning" />
        <KpiSmall icon={CheckCircle2} label="Aprovadas" value={aprovadas.length} tone="success" />
        <KpiSmall icon={XCircle} label="Rejeitadas" value={rejeitadas.length} tone="muted" />
        <KpiSmall icon={Inbox} label="Total" value={filtered.length} tone="default" />
      </div>

      <SectionCard
        icon={Inbox}
        title="Solicitações de despesa & reembolso"
        description="Triagem das solicitações enviadas pelos módulos. Aprove para provisionar no fluxo de caixa."
        actions={
          <div className="flex items-center gap-2">
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Módulo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os módulos</SelectItem>
                {MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSubtype} onValueChange={setFilterSubtype}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os tipos</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="reimbursement">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <Tabs value={subTab} onValueChange={setSubTab}>
          <TabsList className="bg-muted/40 border border-border p-1 h-auto">
            <TabsTrigger value="pendentes" className="text-xs">
              Pendentes <Badge variant="secondary" className="ml-1 h-4 px-1">{pendentes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="aprovadas" className="text-xs">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejeitadas" className="text-xs">Rejeitadas</TabsTrigger>
            <TabsTrigger value="todas" className="text-xs">Todas</TabsTrigger>
            <TabsTrigger value="politicas" className="text-xs">Políticas & SLAs</TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes">
            <RequestsTable
              rows={pendentes}
              onView={handleViewDetail}
              onApprove={handleApprove}
              onReject={handleRejectClick}
              showActions
            />
          </TabsContent>
          <TabsContent value="aprovadas">
            <RequestsTable rows={aprovadas} onView={handleViewDetail} />
          </TabsContent>
          <TabsContent value="rejeitadas">
            <RequestsTable rows={rejeitadas} onView={handleViewDetail} />
          </TabsContent>
          <TabsContent value="todas">
            <RequestsTable rows={filtered} onView={handleViewDetail} />
          </TabsContent>
          <TabsContent value="politicas">
            <PoliciesAndSlasPanel />
          </TabsContent>
        </Tabs>
      </SectionCard>

      <ApproveRequestDialog open={approveOpen} onOpenChange={setApproveOpen} request={selected} />
      <RequestDetailDrawer open={detailOpen} onOpenChange={setDetailOpen} request={selected} />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiSmall({ icon: Icon, label, value, tone }: any) {
  const toneClass = {
    warning: "text-amber-600 dark:text-amber-400",
    success: "text-emerald-600 dark:text-emerald-400",
    muted: "text-muted-foreground",
    default: "text-foreground",
  }[tone as string] ?? "";
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center justify-between">
      <div>
        <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
      <Icon className={`h-5 w-5 ${toneClass}`} />
    </div>
  );
}

function RequestsTable({
  rows,
  onView,
  onApprove,
  onReject,
  showActions,
}: {
  rows: any[];
  onView: (r: any) => void;
  onApprove?: (r: any) => void;
  onReject?: (r: any) => void;
  showActions?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma solicitação.</p>;
  }
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Criada</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const parsed = parseRequestDescription(r.description);
            return (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => onView(r)}>
                <TableCell className="font-medium max-w-[260px] truncate">{r.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={moduleColors[r.reference_module] ?? ""}>
                    {r.reference_module ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">
                    {parsed.subtype === "reimbursement" ? "Reembolso" : "Despesa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(parsed.estimated_value)}</TableCell>
                <TableCell className="text-xs">{r.data_vencimento ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={priorityColors[r.priority] as any ?? "secondary"} className="text-[10px]">
                    {r.priority}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => onView(r)}><Eye className="h-3.5 w-3.5" /></Button>
                    {showActions && (
                      <>
                        <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => onApprove?.(r)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onReject?.(r)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PoliciesAndSlasPanel() {
  const { policies, create: createPolicy, update: updatePolicy, remove: removePolicy } = useExpensePolicies();
  const { slas, upsert: upsertSla, remove: removeSla } = useRequestSlas();

  const [policyOpen, setPolicyOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [policyForm, setPolicyForm] = useState({
    source_module: "dp",
    subtype: "expense",
    title: "",
    description: "",
    max_value: "",
    requires_attachment: true,
  });

  const [slaOpen, setSlaOpen] = useState(false);
  const [slaForm, setSlaForm] = useState({
    source_module: "dp",
    subtype: "expense",
    priority: "media",
    sla_hours: "24",
  });

  const openNewPolicy = () => {
    setEditingPolicy(null);
    setPolicyForm({ source_module: "dp", subtype: "expense", title: "", description: "", max_value: "", requires_attachment: true });
    setPolicyOpen(true);
  };

  const openEditPolicy = (p: any) => {
    setEditingPolicy(p);
    setPolicyForm({
      source_module: p.source_module,
      subtype: p.subtype,
      title: p.title,
      description: p.description ?? "",
      max_value: p.max_value ? String(p.max_value) : "",
      requires_attachment: p.requires_attachment,
    });
    setPolicyOpen(true);
  };

  const savePolicy = async () => {
    const payload = {
      source_module: policyForm.source_module as any,
      subtype: policyForm.subtype as any,
      title: policyForm.title,
      description: policyForm.description || null,
      max_value: policyForm.max_value ? Number(policyForm.max_value) : null,
      requires_attachment: policyForm.requires_attachment,
    };
    if (editingPolicy) await updatePolicy.mutateAsync({ id: editingPolicy.id, ...payload });
    else await createPolicy.mutateAsync(payload);
    setPolicyOpen(false);
  };

  const saveSla = async () => {
    await upsertSla.mutateAsync({
      source_module: slaForm.source_module as any,
      subtype: slaForm.subtype as any,
      priority: slaForm.priority as any,
      sla_hours: Number(slaForm.sla_hours),
    });
    setSlaOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Políticas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Políticas de despesa & reembolso
          </h3>
          <Button size="sm" onClick={openNewPolicy}><Plus className="h-3.5 w-3.5 mr-1" /> Nova política</Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Visíveis a todos os colaboradores no momento da solicitação. Garantem transparência sobre o que é permitido.
        </p>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Valor máx.</TableHead>
                <TableHead>Anexo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-4">Nenhuma política cadastrada.</TableCell></TableRow>
              )}
              {policies.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell><Badge variant="outline" className={moduleColors[p.source_module]}>{p.source_module}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{p.subtype === "reimbursement" ? "Reembolso" : "Despesa"}</Badge></TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{p.max_value ? fmt(Number(p.max_value)) : "—"}</TableCell>
                  <TableCell>{p.requires_attachment ? "Obrigatório" : "Opcional"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEditPolicy(p)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removePolicy.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* SLAs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> SLAs de resposta
          </h3>
          <Button size="sm" onClick={() => setSlaOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo SLA</Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Tempo máximo (em horas) para o financeiro responder cada combinação de módulo + tipo + prioridade.
        </p>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">SLA</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-4">Nenhum SLA configurado.</TableCell></TableRow>
              )}
              {slas.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><Badge variant="outline" className={moduleColors[s.source_module]}>{s.source_module}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{s.subtype === "reimbursement" ? "Reembolso" : "Despesa"}</Badge></TableCell>
                  <TableCell><Badge variant={priorityColors[s.priority] as any}>{s.priority}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{s.sla_hours}h</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeSla.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Policy dialog */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPolicy ? "Editar política" : "Nova política"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Módulo</Label>
                <Select value={policyForm.source_module} onValueChange={(v) => setPolicyForm({ ...policyForm, source_module: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={policyForm.subtype} onValueChange={(v) => setPolicyForm({ ...policyForm, subtype: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="reimbursement">Reembolso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} placeholder="Ex: Reembolso de viagens" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={policyForm.description} onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Valor máximo (R$)</Label>
                <Input type="number" value={policyForm.max_value} onChange={(e) => setPolicyForm({ ...policyForm, max_value: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="req-att"
                  checked={policyForm.requires_attachment}
                  onCheckedChange={(v) => setPolicyForm({ ...policyForm, requires_attachment: !!v })}
                />
                <Label htmlFor="req-att" className="cursor-pointer">Anexo obrigatório</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyOpen(false)}>Cancelar</Button>
            <Button onClick={savePolicy} disabled={!policyForm.title.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SLA dialog */}
      <Dialog open={slaOpen} onOpenChange={setSlaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo SLA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Módulo</Label>
                <Select value={slaForm.source_module} onValueChange={(v) => setSlaForm({ ...slaForm, source_module: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={slaForm.subtype} onValueChange={(v) => setSlaForm({ ...slaForm, subtype: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="reimbursement">Reembolso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={slaForm.priority} onValueChange={(v) => setSlaForm({ ...slaForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>SLA (horas)</Label>
                <Input type="number" value={slaForm.sla_hours} onChange={(e) => setSlaForm({ ...slaForm, sla_hours: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlaOpen(false)}>Cancelar</Button>
            <Button onClick={saveSla}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SolicitacoesTab;
