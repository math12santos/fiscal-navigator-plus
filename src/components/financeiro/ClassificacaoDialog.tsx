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
import { Loader2, Tag, FileText } from "lucide-react";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useEntities } from "@/hooks/useEntities";
import { SearchableSelect } from "@/components/ui/searchable-select";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** For classifying expense requests */
  request?: Request | null;
  /** For classifying DP/contract projections */
  projections?: FinanceiroEntry[];
  onConfirmRequest?: (requestId: string, data: ClassificationData) => Promise<void>;
  onConfirmProjections?: (items: { entry: FinanceiroEntry; classification: ClassificationData }[]) => Promise<void>;
  isPending: boolean;
}

export function ClassificacaoDialog({
  open, onOpenChange, request, projections, onConfirmRequest, onConfirmProjections, isPending,
}: Props) {
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();
  const { entities } = useEntities();

  const analyticalAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  const [form, setForm] = useState<ClassificationData>({
    account_id: "",
    cost_center_id: "",
    natureza_contabil: "despesa",
    competencia: "",
    data_vencimento: "",
    valor_previsto: 0,
    notes: "",
  });

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
    }
  }, [request]);

  // Pre-fill from first projection
  useEffect(() => {
    if (projections && projections.length > 0 && !request) {
      const first = projections[0];
      setForm({
        account_id: first.account_id || "",
        cost_center_id: first.cost_center_id || "",
        natureza_contabil: first.natureza_contabil || "despesa",
        competencia: first.competencia || "",
        data_vencimento: first.data_vencimento || first.data_prevista || "",
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

  const isProjectionMode = !request && projections && projections.length > 0;

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

        {/* Section 2: Classification (editable) */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <FileText className="h-4 w-4" /> Classificação Contábil
          </h4>

          <div>
            <Label>Conta Financeira (Plano de Contas) *</Label>
            <SearchableSelect
              options={analyticalAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
              value={form.account_id}
              onValueChange={(v) => setForm({ ...form, account_id: v })}
              placeholder="Selecione a conta..."
            />
          </div>

          <div>
            <Label>Centro de Custo *</Label>
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
