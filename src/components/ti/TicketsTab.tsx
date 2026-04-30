import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useITTickets } from "@/hooks/useITTickets";

const CATS = ["suporte_tecnico","manutencao_equipamento","solicitacao_acesso","bloqueio_acesso","instalacao_sistema","problema_sistema","problema_internet","problema_email","solicitacao_compra","solicitacao_troca","seguranca_informacao","outro"];
const PRIO = ["baixa","media","alta","critica"];
const STATUSES = ["aberto","em_analise","em_atendimento","aguardando_terceiro","aguardando_solicitante","resolvido","cancelado"];
const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const PRIO_TONE: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-primary/15 text-primary",
  alta: "bg-warning/15 text-warning",
  critica: "bg-destructive/15 text-destructive",
};

export function TicketsTab() {
  const { list, upsert, remove } = useITTickets();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>(null);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const rows = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (list.data ?? []).filter((s: any) => !t || [s.title, s.ticket_number].filter(Boolean).some((x: string) => x.toLowerCase().includes(t)));
  }, [list.data, q]);

  const isOverdue = (t: any) => t.due_at && new Date(t.due_at) < new Date() && !["resolvido", "cancelado"].includes(t.status);

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar chamado..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => { setV({ category: "suporte_tecnico", priority: "media", status: "aberto" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo chamado</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="p-3">#</th><th className="p-3">Título</th><th className="p-3">Categoria</th>
                <th className="p-3">Prioridade</th><th className="p-3">Status</th><th className="p-3">Prazo</th>
                <th className="p-3 text-right w-28">Ações</th>
              </tr></thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
                {!list.isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum chamado.</td></tr>}
                {rows.map((s: any) => (
                  <tr key={s.id} className={`border-t hover:bg-muted/30 ${isOverdue(s) ? "bg-destructive/5" : ""}`}>
                    <td className="p-3 font-mono text-xs">{s.ticket_number}</td>
                    <td className="p-3 font-medium">{s.title}</td>
                    <td className="p-3 capitalize">{s.category?.replace(/_/g, " ")}</td>
                    <td className="p-3"><Badge className={PRIO_TONE[s.priority]}>{labelize(s.priority)}</Badge></td>
                    <td className="p-3"><Badge variant="outline">{labelize(s.status)}</Badge></td>
                    <td className="p-3">
                      {s.due_at ? (
                        <span className={isOverdue(s) ? "text-destructive font-medium" : ""}>
                          {isOverdue(s) && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {new Date(s.due_at).toLocaleDateString("pt-BR")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setV(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogHeader><DialogTitle>{v.id ? `Chamado ${v.ticket_number}` : "Novo chamado"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Título *</Label><Input value={v.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="col-span-2"><Label>Descrição</Label><Textarea value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={v.category} onValueChange={(val) => set("category", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={v.priority} onValueChange={(val) => set("priority", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIO.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={v.status} onValueChange={(val) => set("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="datetime-local" value={v.due_at ? v.due_at.slice(0, 16) : ""} onChange={(e) => set("due_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
              <div className="col-span-2"><Label>Solução aplicada</Label><Textarea value={v.solution ?? ""} onChange={(e) => set("solution", e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={!v.title} onClick={() => { upsert.mutate(v); setOpen(false); }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
