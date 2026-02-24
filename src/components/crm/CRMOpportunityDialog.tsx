import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CRMOpportunity, CRMClient, PipelineStage } from "@/hooks/useCRM";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<CRMOpportunity>) => void;
  initial?: CRMOpportunity | null;
  clients: CRMClient[];
  stages: PipelineStage[];
}

export function CRMOpportunityDialog({ open, onOpenChange, onSave, initial, clients, stages }: Props) {
  const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index).filter((s) => !s.is_lost);

  const [form, setForm] = useState<Partial<CRMOpportunity>>(
    initial ?? {
      title: "",
      estimated_value: 0,
      recurrence: "mensal",
      stage_id: sortedStages[0]?.id ?? "",
      client_id: "",
    }
  );

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.title?.trim() || !form.client_id || !form.stage_id) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Cliente *</Label>
            <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Etapa</Label>
            <Select value={form.stage_id ?? ""} onValueChange={(v) => set("stage_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sortedStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.probability}%)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Estimado (R$)</Label>
              <Input type="number" value={form.estimated_value ?? 0} onChange={(e) => set("estimated_value", Number(e.target.value))} />
            </div>
            <div>
              <Label>Data Prevista</Label>
              <Input type="date" value={form.estimated_close_date ?? ""} onChange={(e) => set("estimated_close_date", e.target.value || null)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Recorrência</Label>
              <Select value={form.recurrence ?? "mensal"} onValueChange={(v) => set("recurrence", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unico">Único</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsible ?? ""} onChange={(e) => set("responsible", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{initial ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
