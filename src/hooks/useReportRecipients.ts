import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface ReportRecipient {
  id: string;
  schedule_id: string;
  user_id: string | null;
  role: string | null;
  chat_binding_id: string | null;
  mask_values_override: boolean | null;
  escalation_level: number;
  active: boolean;
}

export function useReportRecipients(scheduleId?: string) {
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["report_recipients", scheduleId],
    enabled: !!scheduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_recipients")
        .select("*")
        .eq("schedule_id", scheduleId!);
      if (error) throw error;
      return data as ReportRecipient[];
    },
  });

  const create = useMutation({
    mutationFn: async (r: Partial<ReportRecipient>) => {
      const { error } = await supabase.from("report_recipients").insert({
        schedule_id: scheduleId!,
        ...r,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_recipients"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_recipients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_recipients"] }),
  });

  return { recipients: data, isLoading, create, remove };
}

export function useReportDeliveries() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["report_deliveries", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_deliveries")
        .select("*, report_runs(template_code, generated_at)")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}
