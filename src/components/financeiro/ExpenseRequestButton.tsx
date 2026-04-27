import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SendHorizonal, Paperclip, X, Sparkles } from "lucide-react";
import { useCreateRequest } from "@/hooks/useRequests";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useEntities } from "@/hooks/useEntities";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useSupplierClassificationHistory } from "@/hooks/useSupplierClassificationHistory";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { SearchableSelect } from "@/components/ui/searchable-select";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = ".pdf,.xml";

export function ExpenseRequestButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    justificativa: "",
    priority: "media",
    cost_center_id: "",
    estimated_value: "",
    entity_id: "",
    account_id: "",
    competencia: format(new Date(), "yyyy-MM"),
    data_vencimento: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const createRequest = useCreateRequest();
  const { costCenters } = useCostCenters();
  const { entities } = useEntities();
  const { accounts } = useChartOfAccounts();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const suppliers = entities.filter((e) => e.type === "fornecedor" && e.active);
  const analyticalAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  // Auto-suggestion from supplier history
  const { suggestedAccountId, suggestedCostCenterId } = useSupplierClassificationHistory(
    form.entity_id || null
  );

  // Auto-fill when supplier suggestion arrives and fields are empty
  useEffect(() => {
    if (suggestedAccountId && !form.account_id) {
      setForm((prev) => ({ ...prev, account_id: suggestedAccountId }));
    }
    if (suggestedCostCenterId && !form.cost_center_id) {
      setForm((prev) => ({ ...prev, cost_center_id: suggestedCostCenterId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedAccountId, suggestedCostCenterId]);

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
      const { error: uploadErr } = await supabase.storage
        .from("request-attachments")
        .upload(filePath, file);
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

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    try {
      setUploading(true);
      const req = await createRequest.mutateAsync({
        title: form.title,
        type: "expense_request",
        area_responsavel: "financeiro",
        reference_module: "financeiro",
        priority: form.priority,
        cost_center_id: form.cost_center_id || null,
        entity_id: form.entity_id || null,
        account_id: form.account_id || null,
        competencia: form.competencia || null,
        data_vencimento: form.data_vencimento || null,
        justificativa: form.justificativa || null,
        description: JSON.stringify({
          text: form.justificativa,
          estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        }),
      });

      // Upload attachments after request creation
      await uploadAttachments(req.id);

      toast({ title: "Solicitação enviada ao financeiro" });
      setOpen(false);
      setForm({
        title: "", justificativa: "", priority: "media", cost_center_id: "",
        estimated_value: "", entity_id: "", account_id: "",
        competencia: format(new Date(), "yyyy-MM"), data_vencimento: "",
      });
      setFiles([]);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = form.title.trim() && !createRequest.isPending && !uploading;
  const hasSuggestion = !!(suggestedAccountId || suggestedCostCenterId);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <SendHorizonal className="h-4 w-4 mr-1" /> Solicitar Despesa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar Despesa ao Financeiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Compra de material de escritório" />
            </div>

            <div>
              <Label>Fornecedor</Label>
              <SearchableSelect
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                value={form.entity_id}
                onValueChange={(v) => setForm({ ...form, entity_id: v, account_id: "", cost_center_id: "" })}
                placeholder="Selecione o fornecedor..."
              />
              {hasSuggestion && form.entity_id && (
                <div className="flex items-center gap-1 mt-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Classificação sugerida com base no histórico</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor estimado</Label>
                <Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} placeholder="0,00" />
              </div>
              <div>
                <Label>Vencimento previsto</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Competência</Label>
                <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
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
              <Textarea value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} rows={3} placeholder="Descreva a necessidade..." />
            </div>

            {/* Attachments */}
            <div>
              <Label className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" /> Anexos (NF, comprovantes)
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
                    Adicionar arquivo (PDF/XML)
                    <input
                      type="file"
                      accept={ACCEPTED_TYPES}
                      multiple
                      onChange={handleFileAdd}
                      className="hidden"
                    />
                  </label>
                )}
                {files.length > 0 && (
                  <p className="text-xs text-muted-foreground">{files.length}/{MAX_FILES} arquivos</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {uploading ? "Enviando..." : createRequest.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
