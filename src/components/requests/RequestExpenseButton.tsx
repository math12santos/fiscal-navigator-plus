import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SendHorizonal, Paperclip, X, Sparkles, Receipt, Wallet, Info, Ticket } from "lucide-react";
import { useCreateRequest } from "@/hooks/useRequests";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useEntities } from "@/hooks/useEntities";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useSupplierClassificationHistory } from "@/hooks/useSupplierClassificationHistory";
import { useExpensePolicies } from "@/hooks/useExpensePolicies";
import { useRequestSlas } from "@/hooks/useRequestSlas";
import { useDepartments } from "@/hooks/useDepartments";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { SearchableSelect } from "@/components/ui/searchable-select";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.xml,.png,.jpg,.jpeg,.webp";

export type RequestSourceModule = "dp" | "juridico" | "ti" | "crm" | "financeiro" | "cadastros";

interface Props {
  sourceModule: RequestSourceModule;
  defaultCostCenterId?: string | null;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
}

const MODULE_LABELS: Record<RequestSourceModule, string> = {
  dp: "Departamento Pessoal",
  juridico: "Jurídico",
  ti: "TI",
  crm: "Comercial",
  financeiro: "Financeiro",
  cadastros: "Compras",
};

export function RequestExpenseButton({
  sourceModule,
  defaultCostCenterId = null,
  variant = "outline",
  size = "sm",
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const [subtype, setSubtype] = useState<"expense" | "reimbursement" | "ticket">("expense");
  const [form, setForm] = useState({
    title: "",
    justificativa: "",
    priority: "media",
    cost_center_id: defaultCostCenterId ?? "",
    estimated_value: "",
    entity_id: "",
    account_id: "",
    competencia: format(new Date(), "yyyy-MM"),
    data_vencimento: "",
    // Reimbursement-only
    data_gasto: format(new Date(), "yyyy-MM-dd"),
    forma_pagamento_pessoal: "cartao_pessoal",
    // Ticket-only
    target_department_id: "",
    target_area: "",
    sla_due_date: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const createRequest = useCreateRequest();
  const { costCenters } = useCostCenters();
  const { entities } = useEntities();
  const { accounts } = useChartOfAccounts();
  const { policies } = useExpensePolicies({ sourceModule, subtype: subtype === "ticket" ? "expense" : subtype });
  const { slas } = useRequestSlas({ sourceModule, subtype: subtype === "ticket" ? "expense" : subtype });
  const { data: departments = [] } = useDepartments();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const suppliers = entities.filter((e) => e.type === "fornecedor" && e.active);
  const analyticalAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  const { suggestedAccountId, suggestedCostCenterId } = useSupplierClassificationHistory(form.entity_id || null);

  useEffect(() => {
    if (subtype === "expense" && suggestedAccountId && !form.account_id) {
      setForm((p) => ({ ...p, account_id: suggestedAccountId }));
    }
    if (subtype === "expense" && suggestedCostCenterId && !form.cost_center_id) {
      setForm((p) => ({ ...p, cost_center_id: suggestedCostCenterId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedAccountId, suggestedCostCenterId, subtype]);

  const currentSla = useMemo(() => {
    return slas?.find((s) => s.priority === form.priority);
  }, [slas, form.priority]);

  const requiresAttachment = useMemo(() => {
    return policies?.some((p) => p.requires_attachment) ?? false;
  }, [policies]);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const valid = newFiles.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: `${f.name} excede 20MB`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    e.target.value = "";
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const uploadAttachments = async (requestId: string) => {
    if (!files.length || !currentOrg) return;
    const orgId = currentOrg.id;
    for (const file of files) {
      const filePath = `${orgId}/${requestId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("request-attachments").upload(filePath, file);
      if (uploadErr) {
        if (import.meta.env.DEV) console.error("Upload error:", uploadErr);
        continue;
      }
      await supabase.from("request_attachments" as any).insert({
        request_id: requestId,
        organization_id: orgId,
        user_id: user!.id,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_path: filePath,
        file_size: file.size,
      });
    }
  };

  const reset = () => {
    setSubtype("expense");
    setForm({
      title: "", justificativa: "", priority: "media",
      cost_center_id: defaultCostCenterId ?? "",
      estimated_value: "", entity_id: "", account_id: "",
      competencia: format(new Date(), "yyyy-MM"),
      data_vencimento: "",
      data_gasto: format(new Date(), "yyyy-MM-dd"),
      forma_pagamento_pessoal: "cartao_pessoal",
      target_department_id: "",
      target_area: "",
      sla_due_date: "",
    });
    setFiles([]);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    if (subtype !== "ticket" && requiresAttachment && files.length === 0) {
      toast({
        title: "Anexo obrigatório",
        description: "A política exige pelo menos um comprovante.",
        variant: "destructive",
      });
      return;
    }
    if (subtype === "ticket" && !form.target_department_id && !form.target_area.trim()) {
      toast({
        title: "Selecione o departamento de destino",
        variant: "destructive",
      });
      return;
    }
    try {
      setUploading(true);
      const descPayload: any = {
        subtype,
        text: form.justificativa,
        estimated_value: subtype === "ticket" ? null : (form.estimated_value ? Number(form.estimated_value) : null),
        ...(subtype === "reimbursement" && {
          data_gasto: form.data_gasto || null,
          forma_pagamento_pessoal: form.forma_pagamento_pessoal,
        }),
        ...(subtype === "ticket" && {
          target_department_id: form.target_department_id || null,
          target_area: form.target_area || null,
          sla_due_date: form.sla_due_date || null,
          source_module: sourceModule,
        }),
      };

      const isTicket = subtype === "ticket";
      const targetDept = departments.find((d: any) => d.id === form.target_department_id);
      const requestType = isTicket ? "interdepartmental" : "expense_request";
      const areaResp = isTicket
        ? (form.target_area || (targetDept?.name ?? "operacoes"))
        : "financeiro";

      const req = await createRequest.mutateAsync({
        title: form.title,
        type: requestType,
        area_responsavel: areaResp,
        reference_module: sourceModule,
        priority: form.priority,
        cost_center_id: isTicket ? null : (form.cost_center_id || null),
        entity_id: subtype === "expense" ? (form.entity_id || null) : null,
        account_id: isTicket ? null : (form.account_id || null),
        competencia: isTicket ? null : (form.competencia || null),
        data_vencimento: isTicket ? (form.sla_due_date || null) : (form.data_vencimento || null),
        justificativa: form.justificativa || null,
        description: JSON.stringify(descPayload),
      });

      await uploadAttachments(req.id);

      toast({
        title:
          subtype === "ticket"
            ? "Chamado aberto"
            : subtype === "reimbursement"
              ? "Reembolso enviado ao financeiro"
              : "Solicitação enviada ao financeiro",
        description:
          subtype === "ticket"
            ? `Encaminhado para ${areaResp}`
            : currentSla ? `SLA de resposta: ${currentSla.sla_hours}h` : undefined,
      });
      setOpen(false);
      reset();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = form.title.trim() && !createRequest.isPending && !uploading;
  const hasSuggestion = !!(suggestedAccountId || suggestedCostCenterId);
  const buttonLabel = label ?? "Abrir Chamado";

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Ticket className="h-4 w-4 mr-1" /> {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {subtype === "ticket" ? "Abrir chamado a outro departamento" : "Nova solicitação ao financeiro"}
            </DialogTitle>
            <DialogDescription>
              Origem: <span className="font-medium">{MODULE_LABELS[sourceModule]}</span>
            </DialogDescription>
          </DialogHeader>

          <Tabs value={subtype} onValueChange={(v) => setSubtype(v as any)}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="expense"><Receipt className="h-3.5 w-3.5 mr-1" /> Despesa</TabsTrigger>
              <TabsTrigger value="reimbursement"><Wallet className="h-3.5 w-3.5 mr-1" /> Reembolso</TabsTrigger>
              <TabsTrigger value="ticket"><Ticket className="h-3.5 w-3.5 mr-1" /> Chamado</TabsTrigger>
            </TabsList>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 mt-3">
              {/* Policies hint */}
              {policies && policies.length > 0 && (
                <Alert className="py-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {policies.length} política{policies.length > 1 ? "s" : ""} aplicáve{policies.length > 1 ? "is" : "l"}
                    {requiresAttachment && " · anexo obrigatório"}
                    {currentSla && ` · SLA ${currentSla.sla_hours}h`}
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={subtype === "reimbursement" ? "Ex: Reembolso almoço cliente X" : "Ex: Compra de material"}
                />
              </div>

              <TabsContent value="expense" className="space-y-4 m-0">
                <div>
                  <Label>Fornecedor</Label>
                  <SearchableSelect
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    value={form.entity_id}
                    onValueChange={(v) => setForm({ ...form, entity_id: v, account_id: "", cost_center_id: form.cost_center_id })}
                    placeholder="Selecione o fornecedor..."
                  />
                  {hasSuggestion && form.entity_id && (
                    <div className="flex items-center gap-1 mt-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span className="text-xs text-muted-foreground">Classificação sugerida com base no histórico</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reimbursement" className="space-y-4 m-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data do gasto *</Label>
                    <Input
                      type="date"
                      value={form.data_gasto}
                      onChange={(e) => setForm({ ...form, data_gasto: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Forma de pagamento</Label>
                    <Select
                      value={form.forma_pagamento_pessoal}
                      onValueChange={(v) => setForm({ ...form, forma_pagamento_pessoal: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cartao_pessoal">Cartão pessoal</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX pessoal</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{subtype === "reimbursement" ? "Valor pago" : "Valor estimado"}</Label>
                  <Input
                    type="number"
                    value={form.estimated_value}
                    onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Vencimento previsto</Label>
                  <Input
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Competência</Label>
                  <Input
                    type="month"
                    value={form.competencia}
                    onChange={(e) => setForm({ ...form, competencia: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>
                  Categoria (Plano de Contas)
                  {suggestedAccountId && form.account_id === suggestedAccountId && (
                    <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                      <Sparkles className="h-3 w-3 mr-0.5" /> Sugerido
                    </Badge>
                  )}
                </Label>
                <SearchableSelect
                  options={analyticalAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                  value={form.account_id}
                  onValueChange={(v) => setForm({ ...form, account_id: v })}
                  placeholder="Selecione a conta..."
                />
              </div>

              <div>
                <Label>
                  Centro de Custo
                  {suggestedCostCenterId && form.cost_center_id === suggestedCostCenterId && (
                    <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                      <Sparkles className="h-3 w-3 mr-0.5" /> Sugerido
                    </Badge>
                  )}
                </Label>
                <Select value={form.cost_center_id} onValueChange={(v) => setForm({ ...form, cost_center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Justificativa</Label>
                <Textarea
                  value={form.justificativa}
                  onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
                  rows={3}
                  placeholder="Descreva a necessidade ou contexto do gasto..."
                />
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" /> Anexos {requiresAttachment && <span className="text-destructive">*</span>}
                </Label>
                <div className="mt-1 space-y-2">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm rounded-md border bg-muted/30 px-2 py-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button type="button" onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {files.length < MAX_FILES && (
                    <label className="flex items-center gap-1.5 text-sm text-primary cursor-pointer hover:underline">
                      <Paperclip className="h-3.5 w-3.5" />
                      Adicionar arquivo (PDF/XML/imagem)
                      <input type="file" accept={ACCEPTED_TYPES} multiple onChange={handleFileAdd} className="hidden" />
                    </label>
                  )}
                  {files.length > 0 && (
                    <p className="text-xs text-muted-foreground">{files.length}/{MAX_FILES} arquivos</p>
                  )}
                </div>
              </div>
            </div>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {uploading || createRequest.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RequestExpenseButton;
