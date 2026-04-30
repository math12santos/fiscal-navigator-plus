import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cachePresets } from "@/lib/cachePresets";

export interface DashboardKPIs {
  contracts: { active_count: number; monthly_value: number };
  liabilities: {
    total: number;
    judiciais: number;
    contingencias_provaveis: number;
    judicial_count: number;
  };
  crm: { weighted_value: number; open_count: number; stale_count: number };
}

const EMPTY: DashboardKPIs = {
  contracts: { active_count: 0, monthly_value: 0 },
  liabilities: { total: 0, judiciais: 0, contingencias_provaveis: 0, judicial_count: 0 },
  crm: { weighted_value: 0, open_count: 0, stale_count: 0 },
};

/**
 * Server-side aggregated dashboard KPIs in a single round-trip.
 * Replaces 3 client-side reductions (contracts/liabilities/CRM) by one RPC.
 */
export function useDashboardKPIs() {
  const { currentOrg } = useOrganization();

  const query = useQuery({
    queryKey: ["dashboard-kpis", currentOrg?.id ?? null],
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data, error } = await supabase.rpc("get_dashboard_kpis", {
        _organization_id: currentOrg?.id ?? null,
      });
      if (error) throw error;
      return (data as unknown as DashboardKPIs) ?? EMPTY;
    },
    placeholderData: keepPreviousData,
    ...cachePresets.operational,
  });

  return {
    kpis: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isInitialLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
  };
}
