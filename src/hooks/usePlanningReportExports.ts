/**
 * Histórico de exportações de PDF do Planejamento.
 *
 * Decisão arquitetural: armazenamos APENAS metadados (data, cenário, versão,
 * filtros aplicados, horizonte). O PDF é regerado on-demand a partir desses
 * parâmetros — assim o histórico permanece leve e os números refletem sempre
 * o estado mais recente do banco. Útil principalmente como trilha de
 * auditoria: "que recorte eu compartilhei com o board no dia X?".
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import type { PlanningFilters } from "@/lib/planningFilters";

export interface PlanningReportExport {
  id: string;
  organization_id: string;
  user_id: string;
  report_type: string;
  scenario_id: string | null;
  scenario_name: string | null;
  budget_version_id: string | null;
  budget_version_name: string | null;
  start_date: string;
  end_date: string;
  filters: PlanningFilters;
  filters_summary: string | null;
  created_at: string;
}

export interface RecordPlanningExportInput {
  startDate: Date;
  endDate: Date;
  filters: PlanningFilters;
  scenarioId: string | null;
  scenarioName: string | null;
  budgetVersionId: string | null;
  budgetVersionName: string | null;
  filtersSummary: string;
  reportType?: string;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function usePlanningReportExports() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["planning_report_exports", currentOrg?.id, user?.id],
    enabled: !!currentOrg?.id && !!user?.id,
    queryFn: async (): Promise<PlanningReportExport[]> => {
      const { data, error } = await supabase
        .from("planning_report_exports" as any)
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as PlanningReportExport[]) ?? [];
    },
  });

  const record = useMutation({
    mutationFn: async (input: RecordPlanningExportInput) => {
      if (!currentOrg?.id || !user?.id) throw new Error("Sem organização ativa.");
      const payload = {
        organization_id: currentOrg.id,
        user_id: user.id,
        report_type: input.reportType ?? "planning_cockpit",
        scenario_id: input.scenarioId,
        scenario_name: input.scenarioName,
        budget_version_id: input.budgetVersionId,
        budget_version_name: input.budgetVersionName,
        start_date: isoDate(input.startDate),
        end_date: isoDate(input.endDate),
        filters: input.filters as any,
        filters_summary: input.filtersSummary,
      };
      const { error } = await supabase
        .from("planning_report_exports" as any)
        .insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning_report_exports"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("planning_report_exports" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning_report_exports"] });
    },
  });

  return { list, record, remove };
}
