import { CRMActivity } from "@/hooks/useCRM";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Calendar, FileText, CheckSquare, BookOpen } from "lucide-react";

interface Props {
  activities: CRMActivity[];
}

const typeIcons: Record<string, any> = {
  ligacao: Phone,
  reuniao: Calendar,
  email: Mail,
  nota: FileText,
  tarefa: CheckSquare,
  playbook: BookOpen,
};

const typeLabels: Record<string, string> = {
  ligacao: "Ligação",
  reuniao: "Reunião",
  email: "E-mail",
  nota: "Nota",
  tarefa: "Tarefa",
  playbook: "Playbook",
};

export function CRMActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada</div>;
  }

  return (
    <div className="space-y-3">
      {activities.map((act) => {
        const Icon = typeIcons[act.type] ?? FileText;
        return (
          <div key={act.id} className="flex gap-3 items-start">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
              <Icon size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{typeLabels[act.type] ?? act.type}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(act.created_at).toLocaleDateString("pt-BR")}
                </span>
                {act.status === "concluida" && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">Concluída</Badge>
                )}
              </div>
              <p className="text-sm text-foreground mt-1">{act.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
