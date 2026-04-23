import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface ReportTemplate {
  code: string;
  name: string;
  description: string | null;
  default_schedule_cron: string | null;
  trigger_type: string;
  category: string;
  active: boolean;
}

export interface ReportSchedule {
  id: string;
  organization_id: string;
  template_code: string;
  cron: string | null;
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  mask_values: boolean;
  notes: string | null;
}

export function useReportTemplates() {
  return useQuery({
    queryKey: ["report_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("active", true)
        .order("category");
      if (error) throw error;
      return data as ReportTemplate[];
    },
  });
}

export function useReportSchedules() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["report_schedules", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_schedules")
        .select("*")
        .eq("organization_id", currentOrg!.id);
      if (error) throw error;
      return data as ReportSchedule[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (s: { template_code: string; cron?: string; enabled: boolean; mask_values: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("report_schedules").upsert(
        {
          organization_id: currentOrg!.id,
          template_code: s.template_code,
          cron: s.cron ?? null,
          enabled: s.enabled,
          mask_values: s.mask_values,
          created_by: u.user!.id,
        },
        { onConflict: "organization_id,template_code" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_schedules"] }),
  });

  const triggerNow = useMutation({
    mutationFn: async (schedule_id: string) => {
      const { data, error } = await supabase.functions.invoke("report-dispatcher", {
        body: { schedule_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_deliveries"] }),
  });

  return { schedules: data, isLoading, upsert, triggerNow };
}
