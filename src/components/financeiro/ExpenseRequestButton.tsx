import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SendHorizonal } from "lucide-react";
import { useCreateRequest } from "@/hooks/useRequests";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useEntities } from "@/hooks/useEntities";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SearchableSelect } from "@/components/ui/searchable-select";

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
  const createRequest = useCreateRequest();
  const { costCenters } = useCostCenters();
  const { entities } = useEntities();
  const { accounts } = useChartOfAccounts();
  const { toast } = useToast();

  const suppliers = entities.filter((e) => e.type === "fornecedor" && e.active);
  const analyticalAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    try {
      await createRequest.mutateAsync({
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
      toast({ title: "Solicitação enviada ao financeiro" });
      setOpen(false);
      setForm({
        title: "", justificativa: "", priority: "media", cost_center_id: "",
        estimated_value: "", entity_id: "", account_id: "",
        competencia: format(new Date(), "yyyy-MM"), data_vencimento: "",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const canSubmit = form.title.trim() && !createRequest.isPending;

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
                onValueChange={(v) => setForm({ ...form, entity_id: v })}
                placeholder="Selecione o fornecedor..."
              />
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
              <Label>Categoria (Plano de Contas)</Label>
              <SearchableSelect
                options={analyticalAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                value={form.account_id}
                onValueChange={(v) => setForm({ ...form, account_id: v })}
                placeholder="Selecione a conta..."
              />
            </div>

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
              <Label>Justificativa</Label>
              <Textarea value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} rows={3} placeholder="Descreva a necessidade..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {createRequest.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
