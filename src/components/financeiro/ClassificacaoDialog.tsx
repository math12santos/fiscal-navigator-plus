import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Tag, FileText, Sparkles, Paperclip, Download, CheckSquare, Square } from "lucide-react";
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

export interface ClassificationData {
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
  onConfirmProjections?: (items: { entry: FinanceiroEntry; classification: ClassificationData }[], saveRule: boolean) => Promise<void>;
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

/** Groups projection entries by their description prefix (e.g. "Salário Líquido", "FGTS") */
function groupProjectionsByType(entries: FinanceiroEntry[]) {
  const groups = new Map<string, FinanceiroEntry[]>();
  for (const e of entries) {
    // Extract the type prefix before " — " (e.g. "Salário Líquido — ANDERSON" → "Salário Líquido")
    const parts = e.descricao.split(" — ");
    const typeKey = parts.length > 1 ? parts[0].trim() : e.descricao;
    if (!groups.has(typeKey)) groups.set(typeKey, []);
    groups.get(typeKey)!.push(e);
  }
  return groups;
}

export function ClassificacaoDialog({
  open, onOpenChange, request, projections, onConfirmRequest, onConfirmProjections, isPending,
}: Props) {
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();
  const { entities } = useEntities();
  const analyticalAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  const { data: attachments = [] } = useRequestAttachments(request?.id);

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

  // Selection state for projection mode — tracks selected entry IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Track which entries have already been classified in this session
  const [classifiedIds, setClassifiedIds] = useState<Set<string>>(new Set());
  // Remember classification to apply to future entries
  const [saveRule, setSaveRule] = useState(true);

  const isProjectionMode = !request && projections && projections.length > 0;

  // Group projections by type for selection UI
  const projectionGroups = useMemo(() => {
    if (!projections) return new Map<string, FinanceiroEntry[]>();
    return groupProjectionsByType(projections);
  }, [projections]);

  // Remaining (unclassified) entries
  const remainingEntries = useMemo(() => {
    if (!projections) return [];
    return projections.filter((p) => !classifiedIds.has(p.id));
  }, [projections, classifiedIds]);

  const remainingGroups = useMemo(() => {
    return groupProjectionsByType(remainingEntries);
  }, [remainingEntries]);

  // Selected entries
  const selectedEntries = useMemo(() => {
    if (!projections) return [];
    return projections.filter((p) => selectedIds.has(p.id));
  }, [projections, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedEntries.reduce((s, e) => s + e.valor_previsto, 0);
  }, [selectedEntries]);

  // Reset state when dialog opens/projections change
  useEffect(() => {
    if (open && isProjectionMode) {
      setSelectedIds(new Set());
      setClassifiedIds(new Set());
      setForm({
        account_id: "",
        cost_center_id: "",
        natureza_contabil: "despesa",
        competencia: "",
        data_vencimento: "",
        valor_previsto: 0,
        notes: "",
      });
      setSaveRule(true);
    }
  }, [open, isProjectionMode]);

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

  // Apply supplier suggestion
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

  // Update valor_previsto when selection changes
  useEffect(() => {
    if (isProjectionMode) {
      setForm((prev) => ({ ...prev, valor_previsto: selectedTotal }));
    }
  }, [selectedTotal, isProjectionMode]);

  const supplier = request?.entity_id
    ? entities.find((e) => e.id === request.entity_id)
    : null;

  const canSubmit = form.account_id && form.cost_center_id && !isPending &&
    (isProjectionMode ? selectedIds.size > 0 : true);

  // Toggle a single entry
  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle all entries in a group
  const toggleGroup = (groupKey: string) => {
    const groupEntries = remainingGroups.get(groupKey) ?? [];
    const groupIds = groupEntries.map((e) => e.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Select all remaining
  const selectAll = () => {
    setSelectedIds(new Set(remainingEntries.map((e) => e.id)));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = async () => {
    if (request && onConfirmRequest) {
      await onConfirmRequest(request.id, form);
      onOpenChange(false);
    } else if (isProjectionMode && onConfirmProjections) {
      const items = selectedEntries.map((entry) => ({ entry, classification: form }));
      await onConfirmProjections(items, saveRule);

      // Mark selected as classified
      const newClassified = new Set(classifiedIds);
      selectedIds.forEach((id) => newClassified.add(id));
      setClassifiedIds(newClassified);
      setSelectedIds(new Set());

      // Reset form for next batch
      setForm({
        account_id: "",
        cost_center_id: "",
        natureza_contabil: "despesa",
        competencia: "",
        data_vencimento: "",
        valor_previsto: 0,
        notes: "",
      });

      // Check if all done
      const totalRemaining = (projections?.length ?? 0) - newClassified.size;
      if (totalRemaining === 0) {
        onOpenChange(false);
      }
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    const { data } = await supabase.storage
      .from("request-attachments")
      .createSignedUrl(attachment.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const hasSuggestion = appliedSuggestion && (suggestedAccountId || suggestedCostCenterId);

  const classifiedCount = classifiedIds.size;
  const totalCount = projections?.length ?? 0;

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
              : "Selecione os itens semelhantes e atribua a classificação contábil. Repita para cada grupo distinto."}
          </DialogDescription>
        </DialogHeader>

        {/* Request context */}
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

        {/* Projection items — selectable by group */}
        {isProjectionMode && (
          <>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Projeções ({remainingEntries.length} restantes de {totalCount})
                </h4>
                <div className="flex items-center gap-2">
                  {classifiedCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {classifiedCount} classificados
                    </Badge>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={selectedIds.size === remainingEntries.length ? deselectAll : selectAll}
                  >
                    {selectedIds.size === remainingEntries.length ? (
                      <><Square className="h-3 w-3 mr-1" /> Desmarcar todos</>
                    ) : (
                      <><CheckSquare className="h-3 w-3 mr-1" /> Selecionar todos</>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {Array.from(remainingGroups.entries()).map(([groupKey, groupEntries]) => {
                  const groupIds = groupEntries.map((e) => e.id);
                  const allGroupSelected = groupIds.every((id) => selectedIds.has(id));
                  const someGroupSelected = groupIds.some((id) => selectedIds.has(id));
                  const groupTotal = groupEntries.reduce((s, e) => s + e.valor_previsto, 0);

                  return (
                    <div key={groupKey} className="space-y-0.5">
                      {/* Group header — click to select/deselect entire group */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupKey)}
                        className={`flex items-center gap-2 w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors ${
                          allGroupSelected
                            ? "bg-primary/10 border border-primary/30"
                            : someGroupSelected
                            ? "bg-primary/5 border border-primary/15"
                            : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <Checkbox
                          checked={allGroupSelected}
                          className="pointer-events-none"
                        />
                        <span className="font-medium flex-1">{groupKey}</span>
                        <Badge variant="outline" className="text-xs font-normal">
                          {groupEntries.length} {groupEntries.length === 1 ? "item" : "itens"}
                        </Badge>
                        <span className="font-medium text-muted-foreground">{fmt(groupTotal)}</span>
                      </button>

                      {/* Individual items within group */}
                      <div className="ml-6 space-y-0">
                        {groupEntries.map((entry) => {
                          const isSelected = selectedIds.has(entry.id);
                          // Extract employee/detail name after " — "
                          const parts = entry.descricao.split(" — ");
                          const detail = parts.length > 1 ? parts.slice(1).join(" — ") : "";

                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => toggleEntry(entry.id)}
                              className={`flex items-center gap-2 w-full text-left rounded px-2 py-0.5 text-xs transition-colors ${
                                isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="pointer-events-none h-3.5 w-3.5"
                              />
                              <span className="truncate flex-1 text-muted-foreground">{detail || entry.descricao}</span>
                              <span className="font-medium text-muted-foreground shrink-0">{fmt(entry.valor_previsto)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedIds.size > 0 && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selecionados</span>
                  <span className="text-sm font-semibold">Total: {fmt(selectedTotal)}</span>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Suggestion banner */}
        {hasSuggestion && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-warning shrink-0" />
            <span className="text-warning-foreground">
              Classificação pré-preenchida com base no histórico do fornecedor. Revise antes de confirmar.
            </span>
          </div>
        )}

        {/* Classification form */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <FileText className="h-4 w-4" /> Classificação Contábil
            {isProjectionMode && selectedIds.size > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                — será aplicada aos {selectedIds.size} itens selecionados
              </span>
            )}
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

          {isProjectionMode && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-rule"
                checked={saveRule}
                onCheckedChange={(checked) => setSaveRule(!!checked)}
              />
              <Label htmlFor="save-rule" className="text-sm font-normal cursor-pointer">
                Aplicar esta classificação automaticamente a lançamentos futuros idênticos
              </Label>
            </div>
          )}

          <div>
            <Label>Observações internas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Observações sobre esta classificação..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Tag className="h-4 w-4 mr-1" />}
            {isProjectionMode
              ? `Classificar ${selectedIds.size} ${selectedIds.size === 1 ? "item" : "itens"}`
              : "Classificar e Gerar Título"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
