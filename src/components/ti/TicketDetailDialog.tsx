import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Clock, CheckCircle2, MessageSquare, Send, Lock } from "lucide-react";
import { useITTickets } from "@/hooks/useITTickets";
import { useITTicketComments } from "@/hooks/useITSLA";

const CATS = ["suporte_tecnico","manutencao_equipamento","solicitacao_acesso","bloqueio_acesso","instalacao_sistema","problema_sistema","problema_internet","problema_email","solicitacao_compra","solicitacao_troca","seguranca_informacao","outro"];
const PRIO = ["baixa","media","alta","critica"];
const STATUSES = ["aberto","em_analise","em_atendimento","aguardando_terceiro","aguardando_solicitante","resolvido","cancelado"];
const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const fmtDateTime = (d?: string | null) => d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const fmtDuration = (mins?: number | null) => {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h < 24) return `${h}h ${m}min`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: any | null;
}

export function TicketDetailDialog({ open, onOpenChange, ticket }: Props) {
  const { upsert } = useITTickets();
  const { list: comments, create: addComment } = useITTicketComments(ticket?.id);
  const [v, setV] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);

  useEffect(() => { if (ticket) setV({ ...ticket }); }, [ticket]);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  if (!v) return null;

  const isNew = !v.id;
  const now = Date.now();
  const responseBreached = v.sla_response_due_at && !v.first_response_at && new Date(v.sla_response_due_at).getTime() < now;
  const resolutionBreached = v.sla_resolution_due_at && !v.resolved_at && new Date(v.sla_resolution_due_at).getTime() < now;

  const handleSave = () => {
    upsert.mutate(v, { onSuccess: () => onOpenChange(false) });
  };

  const handleSend = () => {
    if (!comment.trim()) return;
    addComment.mutate({ content: comment, is_internal: internal }, {
      onSuccess: () => { setComment(""); setInternal(false); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isNew ? "Novo chamado" : <>Chamado <span className="font-mono text-sm">{v.ticket_number}</span></>}
            {responseBreached && <Badge className="bg-destructive/15 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />SLA resposta vencido</Badge>}
            {resolutionBreached && <Badge className="bg-destructive/15 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />SLA resolução vencido</Badge>}
          </DialogTitle>
        </DialogHeader>

        {!isNew && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border rounded-md p-3 bg-muted/30">
            <div>
              <div className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Aberto em</div>
              <div className="font-medium">{fmtDateTime(v.created_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Primeiro atendimento</div>
              <div className="font-medium">{fmtDateTime(v.first_response_at)}</div>
              {v.mtta_minutes != null && <div className="text-muted-foreground">MTTA: {fmtDuration(v.mtta_minutes)}</div>}
            </div>
            <div>
              <div className="text-muted-foreground">Resolvido em</div>
              <div className="font-medium">{fmtDateTime(v.resolved_at)}</div>
              {v.mttr_minutes != null && <div className="text-muted-foreground">MTTR: {fmtDuration(v.mttr_minutes)}</div>}
            </div>
            <div>
              <div className="text-muted-foreground">Prazo SLA resolução</div>
              <div className={`font-medium ${resolutionBreached ? "text-destructive" : ""}`}>{fmtDateTime(v.sla_resolution_due_at)}</div>
            </div>
          </div>
        )}

        <Tabs defaultValue="info" className="mt-2">
          <TabsList>
            <TabsTrigger value="info">Detalhes</TabsTrigger>
            <TabsTrigger value="comments" disabled={isNew}>
              <MessageSquare className="h-3 w-3 mr-1" />Comentários{!isNew && comments.data?.length ? ` (${comments.data.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={v.title ?? ""} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} />
              </div>
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
              <div>
                <Label>Prazo manual (sobrescreve SLA)</Label>
                <Input type="datetime-local" value={v.due_at ? v.due_at.slice(0, 16) : ""} onChange={(e) => set("due_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
              </div>
              <div className="col-span-2">
                <Label>Solução aplicada</Label>
                <Textarea value={v.solution ?? ""} onChange={(e) => set("solution", e.target.value)} rows={2} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-3">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {comments.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {!comments.isLoading && (comments.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem comentários ainda.</p>
              )}
              {(comments.data ?? []).map((c: any) => (
                <div key={c.id} className={`border rounded-md p-3 ${c.is_internal ? "bg-warning/5 border-warning/30" : "bg-muted/30"}`}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{fmtDateTime(c.created_at)}</span>
                    {c.is_internal && <Badge variant="outline" className="text-warning border-warning/30"><Lock className="h-3 w-3 mr-1" />Interno</Badge>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t pt-3">
              <Textarea placeholder="Escreva um comentário..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Switch checked={internal} onCheckedChange={setInternal} />
                  <Label className="cursor-pointer text-xs">Comentário interno (não visível ao solicitante)</Label>
                </div>
                <Button size="sm" onClick={handleSend} disabled={!comment.trim() || addComment.isPending}>
                  <Send className="h-4 w-4 mr-2" />Enviar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {v.status !== "resolvido" && !isNew && (
            <Button variant="secondary" onClick={() => { set("status", "resolvido"); upsert.mutate({ ...v, status: "resolvido" }, { onSuccess: () => onOpenChange(false) }); }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Marcar como resolvido
            </Button>
          )}
          <Button disabled={!v.title} onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
