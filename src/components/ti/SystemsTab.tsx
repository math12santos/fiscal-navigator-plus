import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useITSystems } from "@/hooks/useITSystems";

const CATS = ["erp","crm","financeiro","rh","contabilidade","marketing","vendas","comunicacao","armazenamento","seguranca","bi","automacao","outro"];
const CYCLES = ["mensal","anual","por_usuario","por_volume","por_consumo","vitalicio","outro"];
const STATUSES = ["ativo","em_teste","em_implantacao","suspenso","cancelado"];
const CRIT = ["baixa","media","alta","critica"];
const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SystemsTab() {
  const { list, upsert, remove } = useITSystems();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>(null);

  const rows = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (list.data ?? []).filter((s: any) => !t || [s.name, s.url].filter(Boolean).some((x: string) => x.toLowerCase().includes(t)));
  }, [list.data, q]);

  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar sistema..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => { setV({ category: "outro", billing_cycle: "mensal", status: "ativo", criticality: "media" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo sistema
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Cobrança</th>
                  <th className="p-3">Valor mensal</th>
                  <th className="p-3">Renovação</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
                {!list.isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum sistema cadastrado.</td></tr>}
                {rows.map((s: any) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="p-3"><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.url}</div></td>
                    <td className="p-3 capitalize">{s.category}</td>
                    <td className="p-3 capitalize">{s.billing_cycle?.replace(/_/g, " ")}</td>
                    <td className="p-3">{fmt(Number(s.monthly_value || 0))}</td>
                    <td className="p-3">{s.renewal_date ? new Date(s.renewal_date).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3"><Badge variant="outline">{labelize(s.status)}</Badge></td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setV(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir este sistema?")) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {v && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{v.id ? "Editar sistema" : "Novo sistema"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={v.category} onValueChange={(val) => set("category", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>URL</Label><Input value={v.url ?? ""} onChange={(e) => set("url", e.target.value)} /></div>
              <div><Label>Usuários</Label><Input type="number" value={v.users_count ?? 1} onChange={(e) => set("users_count", parseInt(e.target.value) || 1)} /></div>
              <div>
                <Label>Cobrança</Label>
                <Select value={v.billing_cycle} onValueChange={(val) => set("billing_cycle", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CYCLES.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor mensal</Label><Input type="number" step="0.01" value={v.monthly_value ?? 0} onChange={(e) => set("monthly_value", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Valor anual</Label><Input type="number" step="0.01" value={v.annual_value ?? 0} onChange={(e) => set("annual_value", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Contratado em</Label><Input type="date" value={v.contracted_at ?? ""} onChange={(e) => set("contracted_at", e.target.value || null)} /></div>
              <div><Label>Renovação</Label><Input type="date" value={v.renewal_date ?? ""} onChange={(e) => set("renewal_date", e.target.value || null)} /></div>
              <div>
                <Label>Status</Label>
                <Select value={v.status} onValueChange={(val) => set("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Criticidade</Label>
                <Select value={v.criticality ?? "media"} onValueChange={(val) => set("criticality", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CRIT.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.is_essential} onChange={(e) => set("is_essential", e.target.checked)} />Essencial</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.has_redundancy} onChange={(e) => set("has_redundancy", e.target.checked)} />Tem redundância</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.data_integrated} onChange={(e) => set("data_integrated", e.target.checked)} />Integrado ao FinCore</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.linked_to_budget} onChange={(e) => set("linked_to_budget", e.target.checked)} />Vincular ao orçamento</label>
              </div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={!v.name} onClick={() => { upsert.mutate(v); setOpen(false); }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
