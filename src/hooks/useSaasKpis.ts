import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SaasKpis {
  mrr: number;
  arr: number;
  arpu: number;
  revenue_12m: number;
  open_amount: number;
  overdue_amount: number;
  counts: {
    total_orgs: number;
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
  };
  growth_12m: { month: string; new: number; canceled: number; net: number }[];
  revenue_series_12m: { month: string; invoiced: number; paid: number }[];
  top_revenue: { id: string; name: string; revenue: number }[] | null;
  top_overdue: {
    id: string;
    name: string;
    open_invoices: number;
    overdue_amount: number;
    oldest_due: string;
  }[] | null;
  plan_breakdown: { code: string; name: string; subscribers: number; mrr: number }[] | null;
  generated_at: string;
}

export function useSaasKpis() {
  return useQuery({
    queryKey: ["saas_kpis"],
    queryFn: async (): Promise<SaasKpis> => {
      const { data, error } = await supabase.rpc("get_saas_kpis" as any);
      if (error) throw error;
      return data as unknown as SaasKpis;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
