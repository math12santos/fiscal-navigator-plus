import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Clock, ArrowRight, CheckCircle2, XCircle, Send } from "lucide-react";
import { type Request, useUpdateRequest } from "@/hooks/useRequests";
import { useRequestComments, useAddComment, type RequestComment } from "@/hooks/useRequestComments";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "aberta", label: "Aberta" },
  { value: "em_analise", label: "Em Análise" },
  { value: "em_execucao", label: "Em Execução" },
  { value: "aguardando_aprovacao", label: "Aguardando Aprovação" },
  { value: "concluida", label: "Concluída" },
  { value: "rejeitada", label: "Rejeitada" },
];

const priorityColors: Record<string, string> = {
  urgente: "bg-destructive/10 text-destructive",
  alta: "bg-destructive/10 text-destructive",
  media: "bg-warning/10 text-warning",
  baixa: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  aberta: "bg-primary/10 text-primary",
  em_analise: "bg-warning/10 text-warning",
  em_execucao: "bg-accent/10 text-accent-foreground",
  aguardando_aprovacao: "bg-warning/10 text-warning",
  concluida: "bg-success/10 text-success",
  rejeitada: "bg-destructive/10 text-destructive",
};

const typeIcons: Record<string, typeof MessageSquare> = {};

function CommentIcon({ type }: { type: string }) {
  if (type === "status_change") return <ArrowRight size={14} className="text-primary" />;
  if (type === "assignment") return <Clock size={14} className="text-warning" />;
  if (type === "approval") return <CheckCircle2 size={14} className="text-success" />;
  return <MessageSquare size={14} className="text-muted-foreground" />;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: Request | null;
}

export function RequestDetail({ open, onOpenChange, request }: Props) {
  const { toast } = useToast();
  const updateRequest = useUpdateRequest();
  const { data: comments = [] } = useRequestComments(request?.id);
  const addComment = useAddComment();
  const [newComment, setNewComment] = useState("");

  if (!request) return null;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateRequest.mutateAsync({ id: request.id, status: newStatus });
      toast({ title: "Status atualizado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addComment.mutateAsync({ requestId: request.id, content: newComment });
      setNewComment("");
    } catch (err: any) {
      toast({ title: "Erro ao adicionar comentário", variant: "destructive" });
    }
  };

  const statusLabel = STATUS_OPTIONS.find((s) => s.value === request.status)?.label ?? request.status;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left pr-8">{request.title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className={priorityColors[request.priority]}>
            {request.priority}
          </Badge>
          <Badge variant="outline" className={statusColors[request.status]}>
            {statusLabel}
          </Badge>
          {request.type && <Badge variant="secondary">{request.type}</Badge>}
          {request.area_responsavel && <Badge variant="secondary">{request.area_responsavel}</Badge>}
        </div>

        {request.description && (
          <p className="text-sm text-muted-foreground mt-3">{request.description}</p>
        )}

        <div className="text-xs text-muted-foreground mt-2 space-y-1">
          {request.due_date && (
            <p>Prazo: {format(new Date(request.due_date), "dd/MM/yyyy", { locale: ptBR })}</p>
          )}
          <p>Criado em: {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
        </div>

        <Separator className="my-3" />

        {/* Status change */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Alterar status:</span>
          <Select value={request.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="my-3" />

        {/* Timeline */}
        <p className="text-sm font-medium">Histórico</p>
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 pr-2">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2 text-sm">
                <div className="mt-1"><CommentIcon type={c.type} /></div>
                <div className="flex-1 min-w-0">
                  <p className={c.type === "comment" ? "text-foreground" : "text-muted-foreground italic"}>
                    {c.content}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
            )}
          </div>
        </ScrollArea>

        {/* Add comment */}
        <div className="flex gap-2 mt-3">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Adicionar comentário..."
            rows={2}
            className="flex-1"
          />
          <Button size="icon" onClick={handleAddComment} disabled={addComment.isPending}>
            <Send size={16} />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
