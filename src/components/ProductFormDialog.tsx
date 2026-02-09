import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/hooks/useProducts";
import type { ChartAccount } from "@/hooks/useChartOfAccounts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
  accounts: ChartAccount[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const UNITS = ["un","kg","g","l","ml","m","m²","m³","hr","pç","cx","pct","par","kit"];

export default function ProductFormDialog({ open, onOpenChange, product, accounts, onSubmit, isLoading }: Props) {
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) {
      setForm(product ? { ...product } : { type: "produto", unit: "un", unit_price: 0, active: true });
    }
  }, [open, product]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.name?.trim() || !form.code?.trim()) return;
    onSubmit(product ? { ...form, id: product.id } : form);
  };

  const analyticAccounts = accounts.filter((a) => !a.is_synthetic && a.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto/Serviço" : "Novo Produto/Serviço"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código <span className="text-destructive">*</span></Label>
              <Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="PROD001" />
            </div>
            <div>
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={form.type || "produto"} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Unidade</Label>
              <Select value={form.unit || "un"} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Unitário</Label>
              <Input type="number" step="0.01" value={form.unit_price ?? 0} onChange={(e) => set("unit_price", Number(e.target.value))} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.category || ""} onChange={(e) => set("category", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>NCM</Label>
              <Input value={form.ncm || ""} onChange={(e) => set("ncm", e.target.value)} placeholder="0000.00.00" />
            </div>
            <div>
              <Label>CEST</Label>
              <Input value={form.cest || ""} onChange={(e) => set("cest", e.target.value)} placeholder="00.000.00" />
            </div>
          </div>

          <div>
            <Label>Conta Contábil</Label>
            <Select value={form.account_id || "__none__"} onValueChange={(v) => set("account_id", v === "__none__" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma</SelectItem>
                {analyticAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !form.name?.trim() || !form.code?.trim()}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
