import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag, FileText, Sparkles, Paperclip, Download } from "lucide-react";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useEntities } from "@/hooks/useEntities";
import { useSupplierClassificationHistory } from "@/hooks/useSupplierClassificationHistory";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Request } from "@/hooks/useRequests";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

interface ClassificationData {
  account_id: string;
  cost_center_id: string;
  natureza_contabil: string;
  competencia: string;
  data_vencimento: string;
  valor_previsto: number;
  notes: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: Request | null;
  projections?: FinanceiroEntry[];
  onConfirmRequest?: (requestId: string, data: ClassificationData) => Promise<void>;
  onConfirmProjections?: (items: { entry: FinanceiroEntry; classification: ClassificationData }[]) => Promise<void>;
  isPending: boolean;
}

function useRequestAttachments(requestId: string | null | undefined) {
  return useQuery({
    queryKey: ["request_attachments", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_attachments" as any)
        .select("id, file_name, file_path, file_type, file_size")
        .eq("request_id", requestId!);
      if (error) throw error;
      return (data ?? []) as unknown as Attachment[];
    },
    enabled: !!requestId,
  });
}

export function ClassificacaoDialog({
  open, onOpenChange, request, projections, onConfirmRequest, onConfirmProjections, isPending,
}: Props) {
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();
  const { entities } = useEntities();
  const analyticalAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  // Attachments
  const { data: attachments = [] } = useRequestAttachments(request?.id);

  // Auto-suggestion from supplier history
  const { suggestedAccountId, suggestedCostCenterId } = useSupplierClassificationHistory(
    request?.entity_id
  );

  const [form, setForm] = useState<ClassificationData>({
    account_id: "",
    cost_center_id: "",
    natureza_contabil: "despesa",
    competencia: "",
    data_vencimento: "",
    valor_previsto: 0,
    notes: "",
  });

  const [appliedSuggestion, setAppliedSuggestion] = useState(false);

  // Pre-fill from request data
  useEffect(() => {
    if (request) {
      let estimated = 0;
      try {
        const parsed = JSON.parse(request.description || "{}");
        estimated = parsed.estimated_value || 0;
      } catch {}

      setForm({
        account_id: request.account_id || "",
        cost_center_id: request.cost_center_id || "",
        natureza_contabil: "despesa",
        competencia: request.competencia || "",
        data_vencimento: request.data_vencimento || "",
        valor_previsto: estimated,
        notes: "",
      });
      setAppliedSuggestion(false);
    }
  }, [request]);

  // Apply supplier suggestion if fields are empty
  useEffect(() => {
    if (request && !appliedSuggestion) {
      let changed = false;
      const updates: Partial<ClassificationData> = {};
      if (suggestedAccountId && !form.account_id) {
        updates.account_id = suggestedAccountId;
        changed = true;
      }
      if (suggestedCostCenterId && !form.cost_center_id) {
        updates.cost_center_id = suggestedCostCenterId;
        changed = true;
      }
      if (changed) {
        setForm((prev) => ({ ...prev, ...updates }));
        setAppliedSuggestion(true);
      }
    }
  }, [suggestedAccountId, suggestedCostCenterId, request, appliedSuggestion, form.account_id, form.cost_center_id]);

  // Pre-fill from first projection
  useEffect(() => {
    if (projections && projections.length > 0 && !request) {
      const first = projections[0];
      setForm({
        account_id: first.account_id || "",
        cost_center_id: first.cost_center_id || "",
        natureza_contabil: (first as any).natureza_contabil || "despesa",
        competencia: (first as any).competencia || "",
        data_vencimento: (first as any).data_vencimento || first.data_prevista || "",
        valor_previsto: projections.reduce((s, p) => s + p.valor_previsto, 0),
        notes: "",
      });
    }
  }, [projections, request]);

  const supplier = request?.entity_id
    ? entities.find((e) => e.id === request.entity_id)
    : null;

  const canSubmit = form.account_id && form.cost_center_id && !isPending;

  const handleConfirm = async () => {
    if (request && onConfirmRequest) {
      await onConfirmRequest(request.id, form);
    } else if (projections && onConfirmProjections) {
      await onConfirmProjections(
        projections.map((entry) => ({ entry, classification: form }))
      );
    }
    onOpenChange(false);
  };

  const handleDownload = async (attachment: Attachment) => {
    const { data } = await supabase.storage
      .from("request-attachments")
      .createSignedUrl(attachment.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const isProjectionMode = !request && projections && projections.length > 0;
  const hasSuggestion = appliedSuggestion && (suggestedAccountId || suggestedCostCenterId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> Classificação Financeira
          </DialogTitle>
          <DialogDescription>
            {request
              ? "Revise o contexto da solicitação e atribua a classificação contábil para gerar o título no Contas a Pagar."
              : "Atribua a classificação contábil às projeções selecionadas."}
          </DialogDescription>
        </DialogHeader>

        {/* Section 1: Request context (read-only) */}
        {request && (
          <>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contexto da Solicitação</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Título:</span>{" "}
                  <span className="font-medium">{request.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Prioridade:</span>{" "}
                  <Badge variant="secondary">{request.priority}</Badge>
                </div>
                {supplier && (
                  <div>
                    <span className="text-muted-foreground">Fornecedor:</span>{" "}
                    <span className="font-medium">{supplier.name}</span>
                  </div>
                )}
                {request.justificativa && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Justificativa:</span>{" "}
                    <span>{request.justificativa}</span>
                  </div>
                )}
              </div>

              {/* Attachments list */}
              {attachments.length > 0 && (
                <div className="pt-2 border-t mt-2">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> Anexos ({attachments.length})
                  </h5>
                  <div className="space-y-1">
                    {attachments.map((att) => (
                      <button
                        key={att.id}
                        onClick={() => handleDownload(att)}
                        className="flex items-center gap-2 text-sm w-full text-left hover:bg-muted/50 rounded px-1.5 py-1 transition-colors"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1 text-primary hover:underline">{att.file_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ""}
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Projection items list */}
        {isProjectionMode && (
          <>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Projeções ({projections!.length} itens)
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {projections!.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.descricao}</span>
                    <span className="font-medium text-muted-foreground">{fmt(p.valor_previsto)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-1 border-t">
                <span className="text-sm font-semibold">Total: {fmt(projections!.reduce((s, p) => s + p.valor_previsto, 0))}</span>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Suggestion banner */}
        {hasSuggestion && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-amber-800 dark:text-amber-200">
              Classificação pré-preenchida com base no histórico do fornecedor. Revise antes de confirmar.
            </span>
          </div>
        )}

        {/* Section 2: Classification (editable) */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <FileText className="h-4 w-4" /> Classificação Contábil
          </h4>

          <div>
            <Label>
              Conta Financeira (Plano de Contas) *
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
              Centro de Custo *
              {suggestedCostCenterId && form.cost_center_id === suggestedCostCenterId && (
                <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                  <Sparkles className="h-3 w-3 mr-0.5" /> Sugerido
                </Badge>
              )}
            </Label>
            <SearchableSelect
              options={costCenters.map((cc: any) => ({ value: cc.id, label: `${cc.code} — ${cc.name}` }))}
              value={form.cost_center_id}
              onValueChange={(v) => setForm({ ...form, cost_center_id: v })}
              placeholder="Selecione o centro de custo..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Natureza Contábil</Label>
              <Select value={form.natureza_contabil} onValueChange={(v) => setForm({ ...form, natureza_contabil: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="custo">Custo</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Previsto</Label>
              <Input type="number" step="0.01" value={form.valor_previsto} onChange={(e) => setForm({ ...form, valor_previsto: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Competência</Label>
              <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Observações internas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Observações sobre esta classificação..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Tag className="h-4 w-4 mr-1" />}
            Classificar e Gerar Título
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
