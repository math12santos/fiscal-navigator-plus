import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, Lightbulb, Bell, BarChart3, FileCheck, ClipboardList, CheckCircle2, PlayCircle,
} from "lucide-react";

interface Props {
  data: Record<string, any>;
  assistedStartDate: string | null;
  onStart: (date: string) => void;
}

const FEATURES = [
  { icon: Bell, label: "Alertas de dados faltantes", desc: "Notificações sobre informações pendentes" },
  { icon: FileCheck, label: "Sugestões de classificação", desc: "Recomendações automáticas de categorização" },
  { icon: ClipboardList, label: "Acompanhamento de preenchimento", desc: "Progresso das rotinas configuradas" },
  { icon: BarChart3, label: "Relatórios semanais automáticos", desc: "Resumo financeiro enviado toda semana" },
];

const TIMELINE = [
  { period: "Semana 1–2", label: "Setup", desc: "Validação de dados, ajustes de estrutura" },
  { period: "Semana 3–4", label: "Ajustes", desc: "Refinamento de classificações e rotinas" },
  { period: "Mês 2–3", label: "Otimização", desc: "Análises avançadas e automações" },
];

export function Step9Assistida({ assistedStartDate, onStart }: Props) {
  const [date, setDate] = useState<Date>(
    assistedStartDate ? new Date(assistedStartDate) : new Date()
  );
  const isStarted = !!assistedStartDate;

  const handleStart = () => {
    onStart(format(date, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb size={24} className="text-primary" />
          Operação Assistida
        </h2>
        <p className="text-muted-foreground mt-1">
          Configure o acompanhamento inteligente nos primeiros 90 dias.
        </p>
      </div>

      {/* Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que é a Operação Assistida?</CardTitle>
          <CardDescription>
            Durante os primeiros 90 dias, o sistema acompanha ativamente sua operação financeira,
            oferecendo alertas, sugestões e relatórios automáticos para garantir que tudo esteja
            funcionando corretamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <f.icon size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline dos 90 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-4 pl-6 border-l-2 border-primary/20">
            {TIMELINE.map((t, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-primary" />
                <Badge variant="outline" className="text-xs mb-1">{t.period}</Badge>
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Date picker + Start */}
      {isStarted ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <CheckCircle2 size={20} className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Operação Assistida Configurada!</p>
            <p className="text-xs text-muted-foreground">
              Início em {format(new Date(assistedStartDate!), "dd/MM/yyyy")} — término previsto em{" "}
              {format(addDays(new Date(assistedStartDate!), 90), "dd/MM/yyyy")}
            </p>
          </div>
          <Badge className="ml-auto">Ativo</Badge>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Data de início</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleStart} size="lg" className="w-full gap-2">
              <PlayCircle size={18} />
              Iniciar Operação Assistida
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
