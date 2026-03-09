import { useCallback } from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Clock, CalendarDays, Calendar } from "lucide-react";

interface Props {
  data: Record<string, any>;
  onChange: (d: Record<string, any>) => void;
}

interface RoutineItem {
  id: string;
  label: string;
  description: string;
}

const DAILY_ROUTINES: RoutineItem[] = [
  { id: "conciliacao", label: "Conciliação bancária", description: "Conferir lançamentos com extratos bancários" },
  { id: "saldo", label: "Atualização de saldo", description: "Registrar posição de caixa diária" },
  { id: "recebimentos", label: "Conferência de recebimentos", description: "Verificar pagamentos recebidos no dia" },
  { id: "aprovacao_pgtos", label: "Aprovação de pagamentos", description: "Revisar e aprovar pagamentos do dia" },
];

const WEEKLY_ROUTINES: RoutineItem[] = [
  { id: "fluxo_caixa", label: "Revisão de fluxo de caixa", description: "Analisar projeções e saldos da semana" },
  { id: "inadimplencia", label: "Análise de inadimplência", description: "Verificar títulos vencidos e ações de cobrança" },
  { id: "pre_aprovacao", label: "Pré-aprovação de pagamentos", description: "Antecipar aprovações da semana seguinte" },
];

const MONTHLY_ROUTINES: RoutineItem[] = [
  { id: "fechamento", label: "Fechamento financeiro", description: "Conciliar e fechar o período contábil" },
  { id: "dre", label: "DRE gerencial", description: "Gerar demonstrativo de resultados do mês" },
  { id: "revisao_contratos", label: "Revisão de contratos", description: "Verificar vencimentos e reajustes" },
  { id: "desvio_orcamentario", label: "Análise de desvio orçamentário", description: "Comparar realizado vs planejado" },
  { id: "reuniao_alinhamento", label: "Reunião de alinhamento", description: "Alinhamento mensal com gestores" },
];

const QUARTERLY_ROUTINES: RoutineItem[] = [
  { id: "reuniao_trimestral", label: "Reunião de alinhamento trimestral", description: "Revisão estratégica com board/investidores" },
];

type FreqKey = "daily" | "weekly" | "monthly" | "quarterly";

const SECTIONS: { key: FreqKey; label: string; icon: typeof Clock; items: RoutineItem[] }[] = [
  { key: "daily", label: "Diárias", icon: Clock, items: DAILY_ROUTINES },
  { key: "weekly", label: "Semanais", icon: CalendarDays, items: WEEKLY_ROUTINES },
  { key: "monthly", label: "Mensais", icon: Calendar, items: MONTHLY_ROUTINES },
  { key: "quarterly", label: "Trimestrais", icon: CalendarCheck, items: QUARTERLY_ROUTINES },
];

export function Step7Rotinas({ data, onChange }: Props) {
  const toggleRoutine = useCallback(
    (freq: FreqKey, routineId: string) => {
      const current: string[] = data[freq] || [];
      const updated = current.includes(routineId)
        ? current.filter((r) => r !== routineId)
        : [...current, routineId];
      onChange({ ...data, [freq]: updated });
    },
    [data, onChange]
  );

  const totalSelected = SECTIONS.reduce(
    (sum, s) => sum + ((data[s.key] as string[]) || []).length,
    0
  );

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <StepHeader
          stepNumber={7}
          fallbackTitle="Rotinas Financeiras"
          fallbackDescription="Selecione as rotinas que pretende adotar no dia a dia"
          fallbackIcon={CalendarCheck}
        />
        <div className="mb-3">
          <Badge variant="secondary">{totalSelected} selecionadas</Badge>
        </div>

        <Accordion type="single" collapsible defaultValue="daily" className="space-y-2">
          {SECTIONS.map((section) => {
            const selected: string[] = data[section.key] || [];
            const Icon = section.icon;
            return (
              <AccordionItem key={section.key} value={section.key} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="text-primary" />
                    <span className="font-medium">{section.label}</span>
                    <Badge variant="secondary">
                      {selected.length}/{section.items.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 py-1">
                    {section.items.map((routine) => (
                      <label
                        key={routine.id}
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        <Checkbox
                          checked={selected.includes(routine.id)}
                          onCheckedChange={() => toggleRoutine(section.key, routine.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            {routine.label}
                          </span>
                          <p className="text-xs text-muted-foreground">{routine.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
