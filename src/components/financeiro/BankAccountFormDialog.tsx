import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    nome: string;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipo_conta: string;
    pix_key: string | null;
  }) => Promise<void>;
  isPending: boolean;
}

export function BankAccountFormDialog({ open, onOpenChange, onSave, isPending }: Props) {
  const [form, setForm] = useState({
    nome: "",
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "corrente",
    pix_key: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    await onSave({
      nome: form.nome,
      banco: form.banco || null,
      agencia: form.agencia || null,
      conta: form.conta || null,
      tipo_conta: form.tipo_conta,
      pix_key: form.pix_key || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conta Bancária</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome da Conta *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Banco do Brasil - CC" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={form.banco} onChange={(e) => set("banco", e.target.value)} placeholder="Ex: Banco do Brasil" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo_conta} onValueChange={(v) => set("tipo_conta", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                  <SelectItem value="pagamento">Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Agência</Label>
              <Input value={form.agencia} onChange={(e) => set("agencia", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Input value={form.conta} onChange={(e) => set("conta", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input value={form.pix_key} onChange={(e) => set("pix_key", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nome || isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
