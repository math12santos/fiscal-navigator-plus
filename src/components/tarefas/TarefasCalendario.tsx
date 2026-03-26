import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRoutineCalendar } from "@/hooks/useRoutineCalendar";
import { useRequests } from "@/hooks/useRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, CalendarDays, List, Play, CheckCircle, Clock,
  AlertCircle, Zap, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  aberta: { label: "Aberta", color: "bg-warning/15 text-warning border-warning/30", icon: AlertCircle },
  em_andamento: { label: "Em andamento", color: "bg-primary/15 text-primary border-primary/30", icon: Play },
  concluida: { label: "Concluída", color: "bg-success/15 text-success border-success/30", icon: CheckCircle },
  cancelada: { label: "Cancelada", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function TarefasCalendario() {
  const [refDate, setRefDate] = useState(new Date());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { calendarTasks, pendingRoutines, generateRoutines, isLoading, competencia } = useRoutineCalendar(refDate);

  // Also fetch all requests for calendar overlay (not just rotina_dp)
  const { data: allRequests = [] } = useRequests();

  // Combine routine tasks + all org requests with due_date in this month
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  const allTasks = useMemo(() => {
    const routineTasks = calendarTasks.map(t => ({
      ...t,
      source: "rotina_dp" as const,
    }));

    const otherTasks = allRequests
      .filter(r => r.type !== "rotina_dp" && r.due_date)
      .filter(r => {
        const d = new Date(r.due_date!);
        return isSameMonth(d, refDate);
      })
      .map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        dueDate: r.due_date,
        status: r.status,
        assignedTo: r.assigned_to,
        priority: r.priority,
        type: "request" as const,
        tasks: [],
        source: "other" as const,
      }));

    return [...routineTasks, ...otherTasks].sort((a, b) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "")
    );
  }, [calendarTasks, allRequests, refDate]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof allTasks> = {};
    allTasks.forEach(t => {
      if (!t.dueDate) return;
      const key = t.dueDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [allTasks]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPad = getDay(monthStart);
    return { days, startPad };
  }, [monthStart, monthEnd]);

  const filteredTasks = selectedDay
    ? allTasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), selectedDay))
    : allTasks;

  const hasPending = pendingRoutines.length > 0;

  return (
    <div className="space-y-4">
      {/* Header: month nav + view toggle + generate button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setRefDate(subMonths(refDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize min-w-[140px] text-center">
            {format(refDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setRefDate(addMonths(refDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasPending && (
            <Button
              variant="default"
              size="sm"
              onClick={() => generateRoutines.mutate()}
              disabled={generateRoutines.isPending}
            >
              <Zap className="h-4 w-4 mr-1" />
              Gerar {pendingRoutines.length} rotina(s)
            </Button>
          )}

          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="calendar" className="px-2 h-7">
                <CalendarDays className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-2 h-7">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <CalendarDays className="h-3 w-3" /> {allTasks.length} tarefas no mês
        </Badge>
        <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/30">
          <CheckCircle className="h-3 w-3" /> {allTasks.filter(t => t.status === "concluida").length} concluídas
        </Badge>
        <Badge variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/30">
          <AlertCircle className="h-3 w-3" /> {allTasks.filter(t => t.status === "aberta").length} pendentes
        </Badge>
        {pendingRoutines.length > 0 && (
          <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30">
            <Zap className="h-3 w-3" /> {pendingRoutines.length} rotina(s) não gerada(s)
          </Badge>
        )}
      </div>

      {view === "calendar" ? (
        <Card>
          <CardContent className="p-4">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {/* Empty cells for padding */}
              {Array.from({ length: calendarDays.startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="bg-card p-1.5 min-h-[80px]" />
              ))}
              {calendarDays.days.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDate[key] ?? [];
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={key}
                    className={cn(
                      "bg-card p-1.5 min-h-[80px] cursor-pointer transition-colors hover:bg-accent/50",
                      isSelected && "ring-2 ring-primary bg-primary/5",
                      isWeekend && "bg-muted/30",
                    )}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                  >
                    <div className={cn(
                      "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                      isToday && "bg-primary text-primary-foreground",
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => {
                        const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.aberta;
                        return (
                          <div
                            key={t.id}
                            className={cn("text-[10px] leading-tight px-1 py-0.5 rounded border truncate", cfg.color)}
                            title={t.title}
                          >
                            {t.title}
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayTasks.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* List view (always shown below calendar when a day is selected, or as main view) */}
      {(view === "list" || selectedDay) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <List className="h-4 w-4" />
              {selectedDay
                ? `Tarefas de ${format(selectedDay, "dd/MM/yyyy")}`
                : `Todas as tarefas — ${format(refDate, "MMMM yyyy", { locale: ptBR })}`}
              {selectedDay && (
                <Button variant="ghost" size="sm" className="text-xs ml-auto" onClick={() => setSelectedDay(null)}>
                  Limpar filtro
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma tarefa {selectedDay ? "neste dia" : "neste mês"}.
              </p>
            ) : (
              filteredTasks.map(t => {
                const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.aberta;
                const Icon = cfg.icon;
                return (
                  <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                    <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", cfg.color.split(" ")[1])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{t.title}</span>
                        <Badge variant="outline" className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>
                        {t.source === "rotina_dp" && (
                          <Badge variant="outline" className="text-[10px] bg-accent/50">Rotina DP</Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {t.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(t.dueDate), "dd/MM/yyyy")}
                          </span>
                        )}
                        {t.priority && (
                          <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending routines detail */}
      {hasPending && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Rotinas pendentes de geração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingRoutines.map(r => (
                <div key={r.routineId} className="flex items-center justify-between p-2 rounded-lg border bg-primary/5">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Cargo: {r.positionName} · {r.periodicity} · {r.assignedEmployees.length} colaborador(es)
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {r.dueDates.length} ocorrência(s)
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
