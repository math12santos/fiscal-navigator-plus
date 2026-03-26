import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addDays, eachDayOfInterval } from "date-fns";

interface RoutineTemplate {
  id: string;
  position_id: string;
  name: string;
  objective: string | null;
  checklist: string | null;
  periodicity: string;
  sla_days: number | null;
  active: boolean;
}

interface EmployeeWithPosition {
  id: string;
  name: string;
  position_id: string | null;
  status: string;
  user_auth_id?: string | null;
}

/**
 * Calculates due dates for a routine based on its periodicity within a given month.
 */
function getRoutineDueDates(periodicity: string, refMonth: Date): Date[] {
  const start = startOfMonth(refMonth);
  const end = endOfMonth(refMonth);

  switch (periodicity) {
    case "diaria": {
      return eachDayOfInterval({ start, end }).filter(d => d.getDay() !== 0 && d.getDay() !== 6);
    }
    case "semanal": {
      // Every Friday of the month
      return eachDayOfInterval({ start, end }).filter(d => d.getDay() === 5);
    }
    case "quinzenal": {
      const d15 = new Date(start.getFullYear(), start.getMonth(), 15);
      return [d15, end];
    }
    case "mensal":
      return [end];
    case "trimestral": {
      // Only on quarter-end months
      const m = start.getMonth();
      if (m % 3 === 2) return [end];
      return [];
    }
    case "anual": {
      // Only in December
      if (start.getMonth() === 11) return [end];
      return [];
    }
    default:
      return [end];
  }
}

export function useRoutineCalendar(refMonth: Date) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const competencia = format(refMonth, "yyyy-MM");
  const rangeFrom = format(startOfMonth(refMonth), "yyyy-MM-dd");
  const rangeTo = format(endOfMonth(refMonth), "yyyy-MM-dd");

  // Fetch all active routines with their position info
  const routinesQuery = useQuery({
    queryKey: ["routine-templates", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("position_routines")
        .select("*, positions:position_id(id, name)")
        .eq("organization_id", orgId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  // Fetch employees to map position → assigned person
  const employeesQuery = useQuery({
    queryKey: ["routine-employees", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, position_id, status, user_auth_id")
        .eq("organization_id", orgId!)
        .eq("status", "ativo");
      if (error) throw error;
      return (data ?? []) as EmployeeWithPosition[];
    },
    enabled: !!orgId,
  });

  // Fetch already generated routine requests for this month
  const generatedQuery = useQuery({
    queryKey: ["routine-requests", orgId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests" as any)
        .select("*, request_tasks:request_tasks(*)")
        .eq("organization_id", orgId!)
        .eq("type", "rotina_dp")
        .eq("competencia", competencia)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
  });

  // Calendar tasks for the month — combine generated + pending generation
  const calendarTasks = (() => {
    const generated = generatedQuery.data ?? [];
    return generated.map((req: any) => ({
      id: req.id,
      title: req.title,
      description: req.description,
      dueDate: req.due_date,
      status: req.status,
      assignedTo: req.assigned_to,
      priority: req.priority,
      type: "generated" as const,
      tasks: req.request_tasks ?? [],
    }));
  })();

  // Compute what routines can still be generated
  const pendingRoutines = (() => {
    const routines = routinesQuery.data ?? [];
    const employees = employeesQuery.data ?? [];
    const generated = generatedQuery.data ?? [];

    const generatedKeys = new Set(
      generated.map((r: any) => r.reference_id) // reference_id = routine template id
    );

    return routines
      .filter((r: any) => {
        const dates = getRoutineDueDates(r.periodicity, refMonth);
        return dates.length > 0 && !generatedKeys.has(r.id);
      })
      .map((r: any) => {
        const assignedEmployees = employees.filter(e => e.position_id === r.position_id);
        return {
          routineId: r.id,
          name: r.name,
          periodicity: r.periodicity,
          positionName: r.positions?.name ?? "—",
          sla_days: r.sla_days,
          checklist: r.checklist,
          objective: r.objective,
          assignedEmployees,
          dueDates: getRoutineDueDates(r.periodicity, refMonth),
        };
      });
  })();

  // Generate routine tasks for the month
  const generateRoutines = useMutation({
    mutationFn: async () => {
      const routines = routinesQuery.data ?? [];
      const employees = employeesQuery.data ?? [];
      const generated = generatedQuery.data ?? [];
      const generatedKeys = new Set(generated.map((r: any) => r.reference_id));

      let created = 0;

      for (const routine of routines) {
        if (generatedKeys.has(routine.id)) continue;
        const dueDates = getRoutineDueDates(routine.periodicity, refMonth);
        if (dueDates.length === 0) continue;

        const assignedEmployees = employees.filter(e => e.position_id === routine.position_id);

        for (const dueDate of dueDates) {
          const dueDateStr = format(dueDate, "yyyy-MM-dd");

          for (const emp of assignedEmployees) {
            // Create request
            const { data: req, error: reqErr } = await supabase
              .from("requests" as any)
              .insert({
                organization_id: orgId,
                user_id: user!.id,
                title: `${routine.name} — ${emp.name}`,
                description: routine.objective || routine.name,
                type: "rotina_dp",
                priority: "media",
                due_date: dueDateStr,
                competencia,
                reference_module: "dp",
                reference_id: routine.id,
                assigned_to: emp.user_auth_id || null,
                status: "aberta",
                area_responsavel: "dp",
              })
              .select()
              .single();
            if (reqErr) throw reqErr;

            const request = req as any;

            // Create task
            await supabase.from("request_tasks" as any).insert({
              request_id: request.id,
              organization_id: orgId,
              title: routine.name,
              assigned_to: emp.user_auth_id || null,
              due_date: dueDateStr,
              created_by: user!.id,
            });

            // Notify if has auth user
            if (emp.user_auth_id) {
              await supabase.from("notifications" as any).insert({
                organization_id: orgId,
                user_id: emp.user_auth_id,
                title: "Nova rotina atribuída",
                body: `${routine.name} — Vencimento: ${format(dueDate, "dd/MM/yyyy")}`,
                type: "assignment",
                priority: "media",
                reference_type: "request",
                reference_id: request.id,
              });
            }

            created++;
          }

          // If no employees for that position, still create unassigned
          if (assignedEmployees.length === 0) {
            const { data: req, error: reqErr } = await supabase
              .from("requests" as any)
              .insert({
                organization_id: orgId,
                user_id: user!.id,
                title: `${routine.name} — Sem responsável`,
                description: routine.objective || routine.name,
                type: "rotina_dp",
                priority: "media",
                due_date: dueDateStr,
                competencia,
                reference_module: "dp",
                reference_id: routine.id,
                status: "aberta",
                area_responsavel: "dp",
              })
              .select()
              .single();
            if (reqErr) throw reqErr;
            created++;
          }
        }
      }

      return created;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["routine-requests"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["my_request_tasks"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Rotinas geradas", description: `${count} tarefa(s) criada(s) para ${competencia}.` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar rotinas", description: err.message, variant: "destructive" });
    },
  });

  return {
    calendarTasks,
    pendingRoutines,
    generateRoutines,
    isLoading: routinesQuery.isLoading || employeesQuery.isLoading || generatedQuery.isLoading,
    competencia,
    rangeFrom,
    rangeTo,
  };
}
