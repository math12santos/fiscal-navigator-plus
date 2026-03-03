import { useMyTasks, useUpdateTask } from "@/hooks/useRequests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, PlayCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const taskStatusConfig: Record<string, { label: string; icon: typeof Clock; className: string; next?: string; nextLabel?: string }> = {
  pendente: { label: "Pendente", icon: AlertCircle, className: "bg-warning/10 text-warning", next: "em_andamento", nextLabel: "Iniciar" },
  em_andamento: { label: "Em Andamento", icon: PlayCircle, className: "bg-primary/10 text-primary", next: "concluida", nextLabel: "Concluir" },
  concluida: { label: "Concluída", icon: CheckCircle, className: "bg-success/10 text-success" },
};

export function MinhasTarefasTab() {
  const { data: tasks = [], isLoading } = useMyTasks();
  const updateTask = useUpdateTask();
  const { toast } = useToast();

  const handleAdvance = async (taskId: string, nextStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: nextStatus });
      toast({ title: "Status atualizado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-8">Carregando...</p>;
  }

  if (tasks.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Nenhuma tarefa atribuída a você.</p>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((t) => {
        const cfg = taskStatusConfig[t.status] ?? taskStatusConfig.pendente;
        const Icon = cfg.icon;
        const req = t.requests;
        return (
          <div key={t.id} className="glass-card p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-lg", cfg.className)}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {req?.type && <span className="capitalize">{req.type} • </span>}
                  {t.due_date && <>Prazo: {format(new Date(t.due_date), "dd/MM/yyyy", { locale: ptBR })} • </>}
                  <Badge variant="outline" className={cn("text-[10px] py-0", cfg.className)}>{cfg.label}</Badge>
                </p>
              </div>
            </div>
            {cfg.next && (
              <Button size="sm" variant="outline" onClick={() => handleAdvance(t.id, cfg.next!)}>
                {cfg.nextLabel}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
