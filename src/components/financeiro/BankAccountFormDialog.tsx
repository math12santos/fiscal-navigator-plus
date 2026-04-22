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
    saldo_atual: number;
    limite_credito: number;
    limite_tipo: string;
    limite_taxa_juros_mensal: number;
    limite_utilizado: number;
    limite_vencimento: string | null;
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
    saldo_atual: "",
    limite_credito: "",
    limite_tipo: "cheque_especial",
    limite_taxa_juros_mensal: "",
    limite_utilizado: "",
    limite_vencimento: "",
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
      saldo_atual: form.saldo_atual ? Number(form.saldo_atual) : 0,
      limite_credito: form.limite_credito ? Number(form.limite_credito) : 0,
      limite_tipo: form.limite_tipo,
      limite_taxa_juros_mensal: form.limite_taxa_juros_mensal ? Number(form.limite_taxa_juros_mensal) : 0,
      limite_utilizado: form.limite_utilizado ? Number(form.limite_utilizado) : 0,
      limite_vencimento: form.limite_vencimento || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Conta Bancária</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Identificação */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">Identificação</h4>
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
            <div className="space-y-2">
              <Label>Saldo Atual</Label>
              <Input type="number" value={form.saldo_atual} onChange={(e) => set("saldo_atual", e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {/* Limite de Crédito / Capital de Giro */}
          <div className="space-y-3 pt-3 border-t">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Limite de Crédito (Capital de Giro)</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Linha de crédito disponível. Compõe a disponibilidade total para projeções e Aging List.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Limite</Label>
                <Select value={form.limite_tipo} onValueChange={(v) => set("limite_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheque_especial">Cheque Especial</SelectItem>
                    <SelectItem value="capital_giro">Capital de Giro</SelectItem>
                    <SelectItem value="conta_garantida">Conta Garantida</SelectItem>
                    <SelectItem value="antecipacao_recebiveis">Antecipação de Recebíveis</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taxa de Juros (% a.m.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.limite_taxa_juros_mensal}
                  onChange={(e) => set("limite_taxa_juros_mensal", e.target.value)}
                  placeholder="Ex: 8,00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Limite Total Aprovado</Label>
                <Input
                  type="number"
                  value={form.limite_credito}
                  onChange={(e) => set("limite_credito", e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Limite Utilizado</Label>
                <Input
                  type="number"
                  value={form.limite_utilizado}
                  onChange={(e) => set("limite_utilizado", e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vencimento / Renovação do Contrato</Label>
              <Input
                type="date"
                value={form.limite_vencimento}
                onChange={(e) => set("limite_vencimento", e.target.value)}
              />
            </div>
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
