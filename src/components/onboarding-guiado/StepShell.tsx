import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
}

export function StepShell({ title, description, icon: Icon, items }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Icon size={24} className="text-primary" />
          {title}
        </h2>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Construction size={16} className="text-muted-foreground" />
            Configuração em progresso
          </CardTitle>
          <CardDescription>
            As funcionalidades abaixo serão detalhadas na próxima fase de implementação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Fase 2</Badge>
        <span className="text-xs text-muted-foreground">
          Você pode avançar e voltar a esta etapa quando desejar.
        </span>
      </div>
    </div>
  );
}
