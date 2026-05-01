import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Network } from "lucide-react";
import { useITTelecom } from "@/hooks/useITTelecom";
import { SectionCard } from "@/components/SectionCard";

const TYPES = ["banda_larga","link_dedicado","telefonia_fixa","telefonia_movel","chip_corporativo","vpn","mpls","outro"];
const STATUSES = ["ativo","em_implantacao","suspenso","cancelado","em_analise"];
const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function TelecomTab() {
  const { list, upsert, remove } = useITTelecom();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>(null);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const rows = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (list.data ?? []).filter((s: any) => !t || [s.name, s.unit_location].filter(Boolean).some((x: string) => x.toLowerCase().includes(t)));
  }, [list.data, q]);

  return (
    <div className="space-y-4">
      <SectionCard
        icon={Network}
        title="Links / Telecom"
        description="Banda larga, links dedicados, telefonia e chips corporativos."
        actions={
          <>
            <div className="relative w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar link/contrato..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button onClick={() => { setV({ link_type: "banda_larga", status: "ativo" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo link</Button>
          </>
        }
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left">
              <th className="p-3">Nome</th><th className="p-3">Tipo</th><th className="p-3">Local</th>
              <th className="p-3">Velocidade</th><th className="p-3">Mensal</th><th className="p-3">Status</th>
              <th className="p-3 text-right w-28">Ações</th>
            </tr></thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!list.isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum link cadastrado.</td></tr>}
              {rows.map((s: any) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 capitalize">{s.link_type?.replace(/_/g, " ")}</td>
                  <td className="p-3">{s.unit_location ?? "—"}</td>
                  <td className="p-3">{s.speed ?? "—"}</td>
                  <td className="p-3">{fmt(Number(s.monthly_value || 0))}</td>
                  <td className="p-3"><Badge variant="outline">{labelize(s.status)}</Badge></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setV(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {v && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{v.id ? "Editar link" : "Novo link"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={v.link_type} onValueChange={(val) => set("link_type", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{labelize(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Local atendido</Label><Input value={v.unit_location ?? ""} onChange={(e) => set("unit_location", e.target.value)} /></div>
              <div><Label>Velocidade</Label><Input value={v.speed ?? ""} onChange={(e) => set("speed", e.target.value)} placeholder="ex: 500 Mbps" /></div>
              <div><Label>SLA</Label><Input value={v.sla ?? ""} onChange={(e) => set("sla", e.target.value)} placeholder="ex: 99,9%" /></div>
              <div><Label>Valor mensal</Label><Input type="number" step="0.01" value={v.monthly_value ?? 0} onChange={(e) => set("monthly_value", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Vencimento (dia)</Label><Input type="number" min={1} max={31} value={v.invoice_due_day ?? ""} onChange={(e) => set("invoice_due_day", parseInt(e.target.value) || null)} /></div>
              <div><Label>Contratado em</Label><Input type="date" value={v.contracted_at ?? ""} onChange={(e) => set("contracted_at", e.target.value || null)} /></div>
              <div><Label>Renovação</Label><Input type="date" value={v.renewal_date ?? ""} onChange={(e) => set("renewal_date", e.target.value || null)} /></div>
              <div>
                <Label>Status</Label>
                <Select value={v.status} onValueChange={(val) => set("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.fixed_ip} onChange={(e) => set("fixed_ip", e.target.checked)} />IP fixo</label>
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
