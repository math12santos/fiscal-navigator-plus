import { useMemo } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Lock, Unlock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFinanceiroMonth } from "@/contexts/FinanceiroMonthContext";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";

/**
 * Banner reutilizável nas abas Financeiras: mostra o mês de trabalho selecionado,
 * status (Aberto / Fechado), permite trocar de mês e limpar o filtro.
 *
 * Esconde-se quando o usuário está no mês corrente sem ter alterado manualmente,
 * para não poluir a tela.
 */
export function WorkingMonthBanner() {
  const { workingMonth, isManual, setWorkingMonth, clearWorkingMonth, currentMonth } =
    useFinanceiroMonth();
  const { isMonthClosed, reopenPeriod } = useFiscalPeriods();

  const closed = useMemo(() => (workingMonth ? isMonthClosed(workingMonth) : false), [
    workingMonth,
    isMonthClosed,
  ]);

  // Esconder quando ainda está no default (mês corrente sem interação).
  if (!isManual && workingMonth === currentMonth) return null;

  const label = workingMonth
    ? format(parse(workingMonth, "yyyy-MM", new Date()), "MMMM 'de' yyyy", { locale: ptBR })
    : "Todos os meses";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 flex-wrap">
      <div className="flex items-center gap-2 text-sm">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Mês de trabalho:</span>
        <span className="font-medium capitalize">{label}</span>
        {workingMonth && (
          <Badge variant={closed ? "destructive" : "secondary"} className="gap-1">
            {closed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {closed ? "Fechado" : "Aberto"}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="month"
          value={workingMonth ?? ""}
          onChange={(e) => setWorkingMonth(e.target.value || null)}
          className="h-8 w-[150px]"
        />
        {closed && workingMonth && (
          <Button size="sm" variant="outline" onClick={() => reopenPeriod.mutate(workingMonth)}>
            <Unlock className="h-3.5 w-3.5 mr-1.5" />
            Reabrir mês
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={clearWorkingMonth} title="Limpar filtro">
          <X className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      </div>
    </div>
  );
}

/** Helper para componentes saberem se o mês de trabalho está fechado (ações desabilitadas). */
export function useWorkingMonthClosed() {
  const { workingMonth } = useFinanceiroMonth();
  const { isMonthClosed } = useFiscalPeriods();
  return workingMonth ? isMonthClosed(workingMonth) : false;
}
