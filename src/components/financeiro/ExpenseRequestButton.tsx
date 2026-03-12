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
import { useToast } from "@/hooks/use-toast";

export function ExpenseRequestButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "media",
    cost_center_id: "",
    estimated_value: "",
  });
  const createRequest = useCreateRequest();
  const { costCenters } = useCostCenters();
  const { toast } = useToast();

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
        description: JSON.stringify({
          text: form.description,
          estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        }),
      });
      toast({ title: "Solicitação enviada ao financeiro" });
      setOpen(false);
      setForm({ title: "", description: "", priority: "media", cost_center_id: "", estimated_value: "" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <SendHorizonal className="h-4 w-4 mr-1" /> Solicitar Despesa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Despesa ao Financeiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Compra de material de escritório" />
            </div>
            <div>
              <Label>Valor estimado</Label>
              <Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} placeholder="0,00" />
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
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Descreva a necessidade..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createRequest.isPending || !form.title.trim()}>
              {createRequest.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
