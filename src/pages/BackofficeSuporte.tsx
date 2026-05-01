import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, MessageSquare, Send, Eye } from "lucide-react";
import {
  useSupportTickets,
  useTicketMessages,
  useUpdateTicket,
  usePostTicketMessage,
  type SupportTicket,
} from "@/hooks/useSupportTickets";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aberto", variant: "destructive" },
  in_progress: { label: "Em andamento", variant: "default" },
  waiting_customer: { label: "Aguardando cliente", variant: "outline" },
  resolved: { label: "Resolvido", variant: "secondary" },
  closed: { label: "Fechado", variant: "secondary" },
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-500",
  urgent: "text-destructive font-semibold",
};

export default function BackofficeSuporte() {
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [priorityFilter, setPriorityFilter] = useState("__all__");
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const { data: tickets = [], isLoading } = useSupportTickets({
    status: statusFilter,
    priority: priorityFilter,
  });

  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    urgent: tickets.filter((t) => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved").length,
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LifeBuoy size={22} className="text-primary" />
          Suporte
        </h1>
        <p className="text-sm text-muted-foreground">Tickets abertos pelos clientes da plataforma</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Abertos</p>
            <p className="text-2xl font-bold text-destructive">{counts.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Em andamento</p>
            <p className="text-2xl font-bold text-primary">{counts.in_progress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Urgentes ativos</p>
            <p className="text-2xl font-bold text-amber-500">{counts.urgent}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas prioridades</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum ticket encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aberto em</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => {
                  const st = STATUS_LABEL[t.status] ?? STATUS_LABEL.open;
                  return (
                    <TableRow key={t.id} className="hover:bg-secondary/50 cursor-pointer" onClick={() => setSelected(t)}>
                      <TableCell className="font-medium text-foreground max-w-md truncate">{t.subject}</TableCell>
                      <TableCell className={PRIORITY_COLOR[t.priority]}>{t.priority}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TicketDetailDialog ticket={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function TicketDetailDialog({ ticket, onClose }: { ticket: SupportTicket | null; onClose: () => void }) {
  const { data: messages = [] } = useTicketMessages(ticket?.id ?? null);
  const updateTicket = useUpdateTicket();
  const postMessage = usePostTicketMessage();
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const { toast } = useToast();

  if (!ticket) return null;

  const handleSend = async () => {
    if (!reply.trim()) return;
    try {
      await postMessage.mutateAsync({ ticket_id: ticket.id, body: reply, is_internal: isInternal });
      setReply("");
      toast({ title: "Mensagem enviada" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: SupportTicket["status"]) => {
    try {
      await updateTicket.mutateAsync({ id: ticket.id, patch: { status } });
      toast({ title: "Status atualizado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            {ticket.subject}
          </DialogTitle>
          <DialogDescription className="flex gap-2 items-center text-xs">
            <Badge variant="outline">{ticket.priority}</Badge>
            <span>•</span>
            <span>{format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {ticket.body && (
            <Card><CardContent className="p-3 text-sm whitespace-pre-wrap">{ticket.body}</CardContent></Card>
          )}

          <div>
            <Label className="text-xs uppercase">Status</Label>
            <Select value={ticket.status} onValueChange={(v) => handleStatusChange(v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase">Conversa</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-md p-3 bg-secondary/20">
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem mensagens ainda.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`p-2 rounded text-sm ${m.is_internal ? "bg-amber-500/10 border border-amber-500/30" : "bg-card"}`}>
                    {m.is_internal && <Badge variant="outline" className="text-[10px] mb-1">Nota interna</Badge>}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase">Responder</Label>
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Sua resposta..." />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                Nota interna (não visível ao cliente)
              </label>
              <Button size="sm" onClick={handleSend} disabled={!reply.trim() || postMessage.isPending}>
                <Send size={14} className="mr-1" /> Enviar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
