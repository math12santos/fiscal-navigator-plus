import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/SectionCard";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useApprovalRules } from "@/hooks/useCompras";

const empty = {
  nome: "",
  escopo: "valor",
  valor_min: 0,
  valor_max: null as number | null,
  approver_role: "admin",
  ordem: 1,
  ativo: true,
};

export function RulesTab() {
  const { rules, isLoading, upsert, remove } = useApprovalRules();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { if (!open) setForm(empty); }, [open]);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <SectionCard
      title="Regras de Aprovação"
      description="Configure alçadas por valor, centro de custo, categoria ou tipo de compra."
      actions={<Button size="sm" onClick={() => { setForm(empty); setOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Nova regra</Button>}
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Escopo</TableHead>
              <TableHead>Faixa</TableHead>
              <TableHead>Aprovador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : rules.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem regras. Sem regra → solicitação vai para aprovação do owner.</TableCell></TableRow>
            ) : (
              rules.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.ordem}</TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="text-xs">{r.escopo}</TableCell>
                  <TableCell className="text-xs">
                    {r.escopo === "valor"
                      ? `${(Number(r.valor_min) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} - ${r.valor_max ? Number(r.valor_max).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "∞"}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.approver_role || r.approver_user_id || "—"}</TableCell>
                  <TableCell><Badge variant={r.ativo ? "default" : "outline"}>{r.ativo ? "Ativa" : "Inativa"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir regra?")) remove.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            <div>
              <Label>Escopo</Label>
              <Select value={form.escopo} onValueChange={(v) => set("escopo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor">Por valor</SelectItem>
                  <SelectItem value="cost_center">Por centro de custo</SelectItem>
                  <SelectItem value="categoria">Por categoria</SelectItem>
                  <SelectItem value="tipo">Por tipo de compra</SelectItem>
                  <SelectItem value="fora_orcamento">Fora do orçamento</SelectItem>
                  <SelectItem value="emergencial">Emergencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ordem</Label><Input type="number" value={form.ordem} onChange={(e) => set("ordem", Number(e.target.value))} /></div>
            {form.escopo === "valor" && (
              <>
                <div><Label>Valor min.</Label><CurrencyInput value={form.valor_min} onValueChange={(v) => set("valor_min", v)} /></div>
                <div><Label>Valor máx. (opcional)</Label><CurrencyInput value={form.valor_max} onValueChange={(v) => set("valor_max", v)} /></div>
              </>
            )}
            <div className="col-span-2">
              <Label>Aprovador (role)</Label>
              <Select value={form.approver_role || "admin"} onValueChange={(v) => set("approver_role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="diretoria">Diretoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate(form, { onSuccess: () => setOpen(false) })} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
