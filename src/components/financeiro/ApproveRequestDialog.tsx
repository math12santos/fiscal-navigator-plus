import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useEntities } from "@/hooks/useEntities";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useUpdateRequest } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { parseRequestDescription } from "@/lib/requestDescription";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: any | null;
}

export function ApproveRequestDialog({ open, onOpenChange, request }: Props) {
  const { entities } = useEntities();
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();
  const { bankAccounts } = useBankAccounts();
  const updateRequest = useUpdateRequest();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const parsed = useMemo(() => parseRequestDescription(request?.description), [request]);
  const isReimbursement = parsed.subtype === "reimbursement";

  const [form, setForm] = useState({
    valor: "",
    data_vencimento: "",
    competencia: "",
    entity_id: "",
    account_id: "",
    cost_center_id: "",
    conta_bancaria_id: "",
    forma_pagamento: "pix",
    num_parcelas: 1,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!request) return;
    setForm({
      valor: parsed.estimated_value ? String(parsed.estimated_value) : "",
      data_vencimento: request.data_vencimento ?? "",
      competencia: request.competencia ?? "",
      entity_id: request.entity_id ?? "",
      account_id: request.account_id ?? "",
      cost_center_id: request.cost_center_id ?? "",
      conta_bancaria_id: "",
      forma_pagamento: "pix",
      num_parcelas: 1,
      notes: parsed.text ?? "",
    });
  }, [request, parsed]);

  const suppliers = entities.filter((e) => (e.type === "fornecedor" || e.type === "funcionario") && e.active);
  const analyticalAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  const handleApprove = async () => {
    if (!request || !currentOrg) return;
    if (!form.valor || Number(form.valor) <= 0) {
      toast({ title: "Informe o valor confirmado", variant: "destructive" });
      return;
    }
    if (!form.account_id) {
      toast({ title: "Selecione a categoria contábil", variant: "destructive" });
      return;
    }
    if (!form.data_vencimento) {
      toast({ title: "Informe a data de vencimento", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const baseDescricao = `${request.title}${isReimbursement ? " (Reembolso)" : ""}`;

      // Create cashflow entry (status=previsto, marca origem)
      const payload: any = {
        organization_id: currentOrg.id,
        user_id: user!.id,
        tipo: "saida",
        categoria: "despesa",
        descricao: baseDescricao,
        valor_previsto: Number(form.valor),
        valor_bruto: Number(form.valor),
        valor_desconto: 0,
        valor_juros_multa: 0,
        data_prevista: form.data_vencimento,
        data_vencimento: form.data_vencimento,
        data_prevista_pagamento: form.data_vencimento,
        status: "previsto",
        account_id: form.account_id,
        cost_center_id: form.cost_center_id || null,
        entity_id: form.entity_id || null,
        conta_bancaria_id: form.conta_bancaria_id || null,
        competencia: form.competencia || null,
        forma_pagamento: form.forma_pagamento,
        num_parcelas: form.num_parcelas || 1,
        notes: form.notes || null,
        source: "request",
        source_ref: `request:${request.id}`,
        expense_request_id: request.id,
        impacto_fluxo_caixa: true,
        impacto_orcamento: true,
        afeta_caixa_no_vencimento: true,
      };

      const { data: entry, error: insertErr } = await supabase
        .from("cashflow_entries" as any)
        .insert(payload)
        .select()
        .single();
      if (insertErr) throw insertErr;

      // Update request: aprovada + link ao cashflow_entry
      await updateRequest.mutateAsync({
        id: request.id,
        status: "aprovada",
        cashflow_entry_id: (entry as any).id,
        classified_by: user!.id,
        classified_at: new Date().toISOString(),
        entity_id: form.entity_id || null,
        account_id: form.account_id,
        cost_center_id: form.cost_center_id || null,
        competencia: form.competencia || null,
        data_vencimento: form.data_vencimento,
      });

      // Notificação ao solicitante
      await supabase.from("notifications" as any).insert({
        organization_id: currentOrg.id,
        user_id: request.user_id,
        title: "Solicitação aprovada",
        body: `${request.title} foi aprovada e provisionada no fluxo de caixa.`,
        type: "request_approved",
        priority: request.priority,
        reference_type: "request",
        reference_id: request.id,
      });

      toast({
        title: "Solicitação aprovada e provisionada",
        description: "Entrada criada no fluxo de caixa com status 'previsto'.",
      });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao aprovar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Aprovar e provisionar
          </DialogTitle>
          <DialogDescription>
            {request.title}
            <Badge variant="secondary" className="ml-2">{isReimbursement ? "Reembolso" : "Despesa"}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <Alert className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A entrada será criada no fluxo de caixa com status <b>previsto</b> e referência à solicitação.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor confirmado *</Label>
              <Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Competência</Label>
              <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
            </div>
            <div>
              <Label>Parcelas</Label>
              <Input type="number" min={1} value={form.num_parcelas} onChange={(e) => setForm({ ...form, num_parcelas: Number(e.target.value) || 1 })} />
            </div>
          </div>

          <div>
            <Label>{isReimbursement ? "Colaborador (favorecido)" : "Fornecedor"}</Label>
            <SearchableSelect
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              value={form.entity_id}
              onValueChange={(v) => setForm({ ...form, entity_id: v })}
              placeholder="Selecione..."
            />
          </div>

          <div>
            <Label>Categoria contábil *</Label>
            <SearchableSelect
              options={analyticalAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
              value={form.account_id}
              onValueChange={(v) => setForm({ ...form, account_id: v })}
              placeholder="Selecione..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Centro de Custo</Label>
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
              <Label>Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Conta bancária prevista</Label>
            <Select value={form.conta_bancaria_id} onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleApprove} disabled={submitting}>
            {submitting ? "Provisionando..." : "Aprovar e provisionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApproveRequestDialog;
