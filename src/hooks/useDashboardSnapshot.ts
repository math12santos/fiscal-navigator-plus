import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useCallback } from "react";

export interface DashboardSnapshotPayload {
  kpis: any;
  cashflow_summary: any;
  current_month: { entradas: number; saidas: number };
  previous_month: { entradas: number; saidas: number };
  expense_by_category: Array<{ name: string; value: number }>;
  avg_monthly_payroll: number;
  range: { from: string; to: string };
  reference_month: string;
}

export interface DashboardSnapshotResult {
  payload: DashboardSnapshotPayload;
  computed_at: string;
  data_version: number;
  cache_hit: boolean;
}

/**
 * Shared dashboard snapshot. Reads the pre-aggregated jsonb cache from the DB:
 * - Cache hit when the snapshot is fresh (TTL 3h) AND the org's data_version
 *   hasn't moved since the snapshot was built. Returns in ~50ms.
 * - Otherwise the RPC recomputes synchronously (~300-700ms) and stores the
 *   result for every other user of the same organization.
 *
 * Triggers in the database bump the org's data_version on every relevant
 * mutation, so the cache invalidates instantly when anyone inputs new data.
 */
export function useDashboardSnapshot(referenceMonth: Date) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const refIso = format(referenceMonth, "yyyy-MM-01");
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["dashboard-snapshot", orgId, refIso],
    queryFn: async (): Promise<DashboardSnapshotResult> => {
      const { data, error } = await supabase.rpc("get_dashboard_snapshot" as any, {
        _organization_id: orgId,
        _reference_month: refIso,
      });
      if (error) throw error;
      return data as DashboardSnapshotResult;
    },
    enabled: !!user && !!orgId,
    staleTime: 3 * 60 * 60_000,
    gcTime: 4 * 60 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase.rpc("get_dashboard_snapshot" as any, {
      _organization_id: orgId,
      _reference_month: refIso,
      _force: true,
    });
    if (error) throw error;
    qc.setQueryData(["dashboard-snapshot", orgId, refIso], data);
  }, [orgId, refIso, qc]);

  return {
    payload: query.data?.payload,
    computedAt: query.data?.computed_at,
    cacheHit: query.data?.cache_hit ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refresh,
  };
}
