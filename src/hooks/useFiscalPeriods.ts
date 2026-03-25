import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useFiscalPeriods() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const orgId = currentOrg?.id;

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["fiscal-periods", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_periods")
        .select("*")
        .eq("organization_id", orgId!)
        .order("year_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isMonthClosed = (yearMonth: string): boolean => {
    const period = periods.find((p: any) => p.year_month === yearMonth);
    return period?.status === "closed";
  };

  const closePeriod = useMutation({
    mutationFn: async (yearMonth: string) => {
      const existing = periods.find((p: any) => p.year_month === yearMonth);
      if (existing) {
        const { error } = await supabase
          .from("fiscal_periods")
          .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user?.id })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fiscal_periods")
          .insert({
            organization_id: orgId!,
            year_month: yearMonth,
            status: "closed",
            closed_at: new Date().toISOString(),
            closed_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-periods"] });
      toast({ title: "Período fechado" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const reopenPeriod = useMutation({
    mutationFn: async (yearMonth: string) => {
      const existing = periods.find((p: any) => p.year_month === yearMonth);
      if (!existing) return;
      const { error } = await supabase
        .from("fiscal_periods")
        .update({ status: "open", reopened_at: new Date().toISOString(), reopened_by: user?.id })
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-periods"] });
      toast({ title: "Período reaberto" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return { periods, isLoading, isMonthClosed, closePeriod, reopenPeriod };
}
