import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Trash2, RefreshCw, Pencil } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  usePurchaseRecurrences, useSuppliers, PERIODICIDADES, TIPOS_COMPRA,
} from "@/hooks/useCompras";

const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RecurrencesTab() {
  const { recurrences, isLoading, upsert, remove, toggleActive, generateNow } = usePurchaseRecurrences();
  const { suppliers } = useSuppliers();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return recurrences;
    return recurrences.filter((r: any) =>
      [r.nome, r.categoria, r.supplier?.razao_social].some((v) => (v || "").toLowerCase().includes(t)),
    );
  }, [recurrences, q]);

  const reset = () =>
    setForm({
      periodicidade: "mensal",
      tipo_compra: "recorrente",
      ativo: true,
      dia_geracao: 1,
      proxima_geracao: new Date().toISOString().split("T")[0],
      data_inicio: new Date().toISOString().split("T")[0],
      valor_estimado: 0,
    });

  return (
    <SectionCard
      title="Recorrências de Compra"
      description="Defina compras recorrentes (assinaturas, materiais periódicos) que geram solicitações automaticamente."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => generateNow.mutate(30)} disabled={generateNow.isPending}>
            <RefreshCw className="mr-1 h-4 w-4" /> Gerar agora
          </Button>
          <Button size="sm" onClick={() => { reset(); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nova recorrência
          </Button>
        </div>
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Periodicidade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Próxima geração</TableHead>
              <TableHead>Gerações</TableHead>
              <TableHead>Ativa</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhuma recorrência cadastrada.</TableCell></TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="text-sm">{r.supplier?.razao_social || "—"}</TableCell>
                  <TableCell className="text-xs capitalize">{r.periodicidade}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(r.valor_estimado) || 0)}</TableCell>
                  <TableCell className="text-xs">{new Date(r.proxima_geracao).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{r.total_geracoes}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.ativo} onCheckedChange={(v) => toggleActive.mutate({ id: r.id, ativo: v })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir recorrência?")) remove.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} recorrência</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Select value={form.supplier_id || "__none__"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "__none__" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sem fornecedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de compra</Label>
              <Select value={form.tipo_compra || "recorrente"} onValueChange={(v) => setForm({ ...form, tipo_compra: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_COMPRA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.categoria || ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div>
              <Label>Valor estimado *</Label>
              <CurrencyInput value={form.valor_estimado ?? 0} onValueChange={(n) => setForm({ ...form, valor_estimado: n })} />
            </div>
            <div>
              <Label>Periodicidade *</Label>
              <Select value={form.periodicidade || "mensal"} onValueChange={(v) => setForm({ ...form, periodicidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia de geração</Label>
              <Input type="number" min={1} max={28} value={form.dia_geracao || 1}
                onChange={(e) => setForm({ ...form, dia_geracao: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Próxima geração *</Label>
              <Input type="date" value={form.proxima_geracao || ""}
                onChange={(e) => setForm({ ...form, proxima_geracao: e.target.value })} />
            </div>
            <div>
              <Label>Data início</Label>
              <Input type="date" value={form.data_inicio || ""}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Data fim (opcional)</Label>
              <Input type="date" value={form.data_fim || ""}
                onChange={(e) => setForm({ ...form, data_fim: e.target.value || null })} />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Switch checked={form.ativo ?? true} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!form.nome || !form.proxima_geracao) return;
              await upsert.mutateAsync(form);
              setOpen(false);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
