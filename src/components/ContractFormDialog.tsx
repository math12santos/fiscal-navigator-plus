import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface ContractFormData {
  nome: string;
  tipo: string;
  valor: number;
  vencimento: string;
  status: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContractFormData) => void;
  initialData?: ContractFormData | null;
  loading?: boolean;
}

const tipos = ["Fornecedor", "Locação", "Tecnologia", "Serviço", "Seguro", "Outro"];
const statuses = ["Ativo", "Próximo ao vencimento", "Vencido", "Cancelado"];

export default function ContractFormDialog({ open, onOpenChange, onSubmit, initialData, loading }: Props) {
  const [form, setForm] = useState<ContractFormData>({
    nome: "",
    tipo: "Fornecedor",
    valor: 0,
    vencimento: "",
    status: "Ativo",
    notes: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({ nome: "", tipo: "Fornecedor", valor: 0, vencimento: "", status: "Ativo", notes: "" });
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do contrato</Label>
            <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required maxLength={200} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor mensal (R$)</Label>
              <Input id="valor" type="number" min={0} step={0.01} value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vencimento">Vencimento</Label>
              <Input id="vencimento" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
