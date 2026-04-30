import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Clock } from "lucide-react";
import { useITTickets } from "@/hooks/useITTickets";
import { TicketDetailDialog } from "./TicketDetailDialog";

const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const PRIO_TONE: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-primary/15 text-primary",
  alta: "bg-warning/15 text-warning",
  critica: "bg-destructive/15 text-destructive",
};

const fmtDuration = (mins?: number | null) => {
  if (mins == null) return null;
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h${Math.round(mins % 60)}m` : `${Math.floor(h / 24)}d${h % 24}h`;
};

export function TicketsTab() {
  const { list, remove } = useITTickets();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any>(null);

  const rows = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (list.data ?? []).filter((s: any) => !t || [s.title, s.ticket_number].filter(Boolean).some((x: string) => x.toLowerCase().includes(t)));
  }, [list.data, q]);

  const slaStatus = (t: any) => {
    const now = Date.now();
    if (t.resolved_at) return { label: "Resolvido", tone: "bg-success/15 text-success" };
    if (t.sla_resolution_due_at && new Date(t.sla_resolution_due_at).getTime() < now) {
      return { label: "Resolução vencida", tone: "bg-destructive/15 text-destructive", icon: true };
    }
    if (t.sla_response_due_at && !t.first_response_at && new Date(t.sla_response_due_at).getTime() < now) {
      return { label: "Resposta vencida", tone: "bg-destructive/15 text-destructive", icon: true };
    }
    if (t.sla_resolution_due_at) {
      const hoursLeft = (new Date(t.sla_resolution_due_at).getTime() - now) / 3600000;
      if (hoursLeft < 4) return { label: `Vence em ${Math.round(hoursLeft)}h`, tone: "bg-warning/15 text-warning" };
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar chamado..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => { setActive({ category: "suporte_tecnico", priority: "media", status: "aberto" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo chamado
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">#</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">SLA</th>
                  <th className="p-3">MTTR</th>
                  <th className="p-3 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
                {!list.isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum chamado.</td></tr>}
                {rows.map((s: any) => {
                  const sla = slaStatus(s);
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => { setActive(s); setOpen(true); }}>
                      <td className="p-3 font-mono text-xs">{s.ticket_number}</td>
                      <td className="p-3 font-medium">{s.title}</td>
                      <td className="p-3 capitalize text-xs">{s.category?.replace(/_/g, " ")}</td>
                      <td className="p-3"><Badge className={PRIO_TONE[s.priority]}>{labelize(s.priority)}</Badge></td>
                      <td className="p-3"><Badge variant="outline">{labelize(s.status)}</Badge></td>
                      <td className="p-3">
                        {sla ? (
                          <Badge className={sla.tone}>
                            {sla.icon ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                            {sla.label}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-3 text-xs">{fmtDuration(s.mttr_minutes) ?? "—"}</td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => { setActive(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TicketDetailDialog open={open} onOpenChange={setOpen} ticket={active} />
    </div>
  );
}
