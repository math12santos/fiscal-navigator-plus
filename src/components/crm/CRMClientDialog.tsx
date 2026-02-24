import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CRMClient } from "@/hooks/useCRM";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<CRMClient>) => void;
  initial?: CRMClient | null;
}

const statusOptions = [
  { value: "prospect", label: "Prospect" },
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "churn", label: "Churn" },
  { value: "em_risco", label: "Em Risco" },
];

const originOptions = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "indicacao", label: "Indicação" },
  { value: "parceiro", label: "Parceiro" },
  { value: "evento", label: "Evento" },
];

const engagementOptions = [
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "Médio" },
  { value: "alto", label: "Alto" },
];

export function CRMClientDialog({ open, onOpenChange, onSave, initial }: Props) {
  const [form, setForm] = useState<Partial<CRMClient>>(
    initial ?? { name: "", status: "prospect", engagement: "medio", churn_risk: "baixo", score: 0, health_score: 50, mrr: 0 }
  );

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.name?.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>CNPJ/CPF</Label>
            <Input value={form.document_number ?? ""} onChange={(e) => set("document_number", e.target.value)} />
          </div>
          <div>
            <Label>Segmento</Label>
            <Input value={form.segment ?? ""} onChange={(e) => set("segment", e.target.value)} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsible ?? ""} onChange={(e) => set("responsible", e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "prospect"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem</Label>
            <Select value={form.origin ?? ""} onValueChange={(v) => set("origin", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {originOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Engajamento</Label>
            <Select value={form.engagement ?? "medio"} onValueChange={(v) => set("engagement", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {engagementOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>MRR (R$)</Label>
            <Input type="number" value={form.mrr ?? 0} onChange={(e) => set("mrr", Number(e.target.value))} />
          </div>
          <div>
            <Label>Score (0-100)</Label>
            <Input type="number" min={0} max={100} value={form.score ?? 0} onChange={(e) => set("score", Number(e.target.value))} />
          </div>
          <div>
            <Label>Health Score (0-100)</Label>
            <Input type="number" min={0} max={100} value={form.health_score ?? 50} onChange={(e) => set("health_score", Number(e.target.value))} />
          </div>
          <div>
            <Label>Risco de Churn</Label>
            <Select value={form.churn_risk ?? "baixo"} onValueChange={(v) => set("churn_risk", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
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
