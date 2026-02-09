import { PageHeader } from "@/components/PageHeader";
import { tasks } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

const statusConfig: Record<string, { icon: typeof CheckCircle; className: string }> = {
  "Concluído": { icon: CheckCircle, className: "bg-success/10 text-success" },
  "Em andamento": { icon: Clock, className: "bg-primary/10 text-primary" },
  "Pendente": { icon: AlertCircle, className: "bg-warning/10 text-warning" },
};

const prioridadeConfig: Record<string, string> = {
  Alta: "bg-destructive/10 text-destructive",
  Média: "bg-warning/10 text-warning",
  Baixa: "bg-muted text-muted-foreground",
};

export default function Tarefas() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Gerenciamento de Rotina" description="Gestão de tarefas financeiras e administrativas" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-warning mt-1">{tasks.filter(t => t.status === "Pendente").length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Em Andamento</p>
          <p className="text-2xl font-bold text-primary mt-1">{tasks.filter(t => t.status === "Em andamento").length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Concluídas</p>
          <p className="text-2xl font-bold text-success mt-1">{tasks.filter(t => t.status === "Concluído").length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((t) => {
          const cfg = statusConfig[t.status];
          const Icon = cfg.icon;
          return (
            <div key={t.id} className="glass-card p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-lg", cfg.className)}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.titulo}</p>
                  <p className="text-xs text-muted-foreground">{t.responsavel} • Prazo: {new Date(t.prazo).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", prioridadeConfig[t.prioridade])}>
                  {t.prioridade}
                </span>
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", cfg.className)}>
                  {t.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
