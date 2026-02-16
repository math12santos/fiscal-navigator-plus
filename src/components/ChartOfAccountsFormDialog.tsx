import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChartAccount } from "@/hooks/useChartOfAccounts";

const TYPES = ["receita", "custo", "despesa", "investimento", "transferencia"] as const;
const NATURES = ["entrada", "saida", "neutro"] as const;
const CLASSES = ["ativo", "passivo", "pl", "resultado"] as const;

const NATURE_LABELS: Record<string, string> = { entrada: "Entrada", saida: "Saída", neutro: "Neutro" };
const CLASS_LABELS: Record<string, string> = { ativo: "Ativo", passivo: "Passivo", pl: "PL", resultado: "Resultado" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ChartAccount | null;
  accounts: ChartAccount[];
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export default function ChartOfAccountsFormDialog({ open, onOpenChange, account, accounts, onSubmit, isLoading }: Props) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "despesa" as string,
    nature: "neutro" as string,
    accounting_class: "resultado" as string,
    level: 1,
    parent_id: null as string | null,
    description: "",
    is_synthetic: false,
    tags: [] as string[],
    active: true,
  });

  useEffect(() => {
    if (account) {
      setForm({
        code: account.code,
        name: account.name,
        type: account.type,
        nature: account.nature,
        accounting_class: account.accounting_class,
        level: account.level,
        parent_id: account.parent_id,
        description: account.description ?? "",
        is_synthetic: account.is_synthetic,
        tags: account.tags ?? [],
        active: account.active,
      });
    } else {
      setForm({
        code: "", name: "", type: "despesa", nature: "neutro", accounting_class: "resultado",
        level: 1, parent_id: null, description: "", is_synthetic: false, tags: [], active: true,
      });
    }
  }, [account, open]);

  const parentOptions = accounts.filter(
    (a) => a.active && a.level < 4 && a.id !== account?.id
  );

  const suggestCode = (parentId: string | null, level: number) => {
    if (!parentId) {
      // Root level: find next available top-level code
      const rootCodes = accounts
        .filter((a) => a.level === 1)
        .map((a) => parseInt(a.code))
        .filter((n) => !isNaN(n));
      const next = rootCodes.length > 0 ? Math.max(...rootCodes) + 1 : 1;
      return String(next);
    }
    const parent = accounts.find((a) => a.id === parentId);
    if (!parent) return "";
    // Find existing children of this parent
    const siblings = accounts.filter((a) => a.parent_id === parentId);
    const siblingSuffixes = siblings
      .map((a) => {
        const parts = a.code.split(".");
        const last = parts[parts.length - 1];
        return parseInt(last);
      })
      .filter((n) => !isNaN(n));
    const nextSuffix = siblingSuffixes.length > 0 ? Math.max(...siblingSuffixes) + 1 : 1;
    const suffix = level >= 3 ? String(nextSuffix).padStart(2, "0") : String(nextSuffix);
    return `${parent.code}.${suffix}`;
  };

  const handleParentChange = (parentId: string | null) => {
    const newLevel = parentId
      ? Math.min((accounts.find((a) => a.id === parentId)?.level ?? 0) + 1, 4)
      : 1;
    const suggestedCode = suggestCode(parentId, newLevel);
    setForm((f) => ({ ...f, parent_id: parentId, level: newLevel, code: suggestedCode }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      description: form.description || null,
      tags: form.tags.length > 0 ? form.tags : null,
      parent_id: form.parent_id || null,
    };
    if (account) {
      onSubmit({ id: account.id, ...payload });
    } else {
      onSubmit(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Editar Conta" : "Nova Conta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="3.1.01" />
            </div>
            <div className="space-y-2">
              <Label>Nível *</Label>
              <Select value={String(form.level)} onValueChange={(v) => setForm({ ...form, level: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((l) => (
                    <SelectItem key={l} value={String(l)}>Nível {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Natureza *</Label>
              <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NATURES.map((n) => (
                    <SelectItem key={n} value={n}>{NATURE_LABELS[n]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Classe Contábil *</Label>
              <Select value={form.accounting_class} onValueChange={(v) => setForm({ ...form, accounting_class: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>{CLASS_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conta Pai</Label>
            <Select value={form.parent_id ?? "__none__"} onValueChange={(v) => handleParentChange(v === "__none__" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma (raiz)</SelectItem>
                {parentOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_synthetic} onCheckedChange={(v) => setForm({ ...form, is_synthetic: v })} />
              <Label className="text-sm">Conta Sintética</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label className="text-sm">Ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{account ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
