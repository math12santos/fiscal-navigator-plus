import { useMemo, useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  setMonth,
  setYear,
  isSameMonth,
  isAfter,
  isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value: Date;
  onChange: (d: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  onResetToday?: () => void;
  className?: string;
}

const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function MonthPicker({
  value,
  onChange,
  minDate,
  maxDate,
  onResetToday,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());

  const today = useMemo(() => startOfMonth(new Date()), []);
  const isCurrent = isSameMonth(value, today);

  const canGoPrev = !minDate || !isSameMonth(value, minDate)
    ? !minDate || isAfter(value, minDate)
    : false;
  const canGoNext = !maxDate || !isSameMonth(value, maxDate)
    ? !maxDate || isBefore(value, maxDate)
    : false;

  const goPrev = () => onChange(startOfMonth(subMonths(value, 1)));
  const goNext = () => onChange(startOfMonth(addMonths(value, 1)));

  const minYear = minDate?.getFullYear() ?? 2000;
  const maxYear = maxDate?.getFullYear() ?? 2099;

  return (
    <div
      className={cn("flex items-center gap-1 rounded-lg border border-border bg-card p-1", className)}
      aria-live="polite"
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={goPrev}
        disabled={!canGoPrev}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setViewYear(value.getFullYear()); }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-sm font-medium gap-1.5"
            aria-expanded={open}
            aria-label={`Selecionar mês competência. Atual: ${format(value, "MMMM 'de' yyyy", { locale: ptBR })}`}
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="capitalize">{format(value, "MMM yyyy", { locale: ptBR }).replace(".", "")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 pointer-events-auto" align="end">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewYear((y) => Math.max(minYear, y - 1))}
              disabled={viewYear <= minYear}
              aria-label="Ano anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold">{viewYear}</div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
              disabled={viewYear >= maxYear}
              aria-label="Próximo ano"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 w-[220px]">
            {MONTHS_PT.map((label, idx) => {
              const candidate = startOfMonth(setMonth(setYear(new Date(), viewYear), idx));
              const disabled =
                (minDate && isBefore(candidate, startOfMonth(minDate))) ||
                (maxDate && isAfter(candidate, startOfMonth(maxDate)));
              const selected = isSameMonth(candidate, value);
              const isToday = isSameMonth(candidate, today);
              return (
                <Button
                  key={label}
                  variant={selected ? "default" : isToday ? "secondary" : "ghost"}
                  size="sm"
                  disabled={disabled}
                  className="h-8 text-xs capitalize"
                  onClick={() => {
                    onChange(candidate);
                    setOpen(false);
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          {onResetToday && (
            <div className="mt-3 pt-3 border-t border-border flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onResetToday();
                  setViewYear(new Date().getFullYear());
                  setOpen(false);
                }}
                disabled={isCurrent}
              >
                Hoje
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={goNext}
        disabled={!canGoNext}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
