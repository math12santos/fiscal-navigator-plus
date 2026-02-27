import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";

interface Props {
  cycle: string;
  setCycle: (v: string) => void;
  cycleOptions: { value: string; label: string; months: number }[];
  isCustom: boolean;
  customFrom?: Date;
  customTo?: Date;
  setCustomFrom: (d: Date | undefined) => void;
  setCustomTo: (d: Date | undefined) => void;
  refDate: Date;
  months: number;
  navigatePeriod: (direction: 1 | -1) => void;
  setRefDate: (d: Date) => void;
}

function getCycleLabel(cycle: string, ref: Date, months: number, customFrom?: Date, customTo?: Date): string {
  if (cycle === "personalizado" && customFrom && customTo) {
    return `${format(customFrom, "dd/MM/yy", { locale: ptBR })} – ${format(customTo, "dd/MM/yy", { locale: ptBR })}`;
  }
  const from = startOfMonth(ref);
  const to = endOfMonth(addMonths(from, months - 1));
  if (months === 1) return format(from, "MMMM yyyy", { locale: ptBR });
  return `${format(from, "MMM/yy", { locale: ptBR })} – ${format(to, "MMM/yy", { locale: ptBR })}`;
}

export function FluxoCaixaPeriodNav({
  cycle, setCycle, cycleOptions, isCustom,
  customFrom, customTo, setCustomFrom, setCustomTo,
  refDate, months, navigatePeriod, setRefDate,
}: Props) {
  const periodLabel = getCycleLabel(cycle, refDate, months, customFrom, customTo);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={cycle} onValueChange={setCycle}>
        <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {cycleOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isCustom ? (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <CalendarIcon size={14} />
                {customFrom ? format(customFrom, "dd/MM/yyyy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <CalendarIcon size={14} />
                {customTo ? format(customTo, "dd/MM/yyyy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center capitalize">{periodLabel}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod(1)}>
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRefDate(new Date())}>Hoje</Button>
        </>
      )}
    </div>
  );
}
