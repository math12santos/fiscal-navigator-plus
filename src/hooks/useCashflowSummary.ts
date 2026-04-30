import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cachePresets } from "@/lib/cachePresets";

export interface CashflowSummary {
  totals: { entradas: number; saidas: number; saldo: number; count: number };
  monthly: Array<{ month: string; entradas: number; saidas: number; saldo: number }>;
  by_category: Array<{ tipo: string; categoria: string; total: number; count: number }>;
}

const EMPTY: CashflowSummary = {
  totals: { entradas: 0, saidas: 0, saldo: 0, count: 0 },
  monthly: [],
  by_category: [],
};

/**
 * Server-side aggregated cashflow summary for a date range.
 * Returns totals, monthly buckets and by-category breakdown in 1 round-trip.
 * Use this for Dashboard KPIs/charts; only fall back to raw `useCashFlow`
 * when you need entry-level detail.
 */
export function useCashflowSummary(rangeFrom: Date, rangeTo: Date) {
  const { currentOrg } = useOrganization();

  const fromStr = format(rangeFrom, "yyyy-MM-dd");
  const toStr = format(rangeTo, "yyyy-MM-dd");

  const query = useQuery({
    queryKey: ["cashflow-summary", currentOrg?.id ?? null, fromStr, toStr],
    queryFn: async (): Promise<CashflowSummary> => {
      const { data, error } = await supabase.rpc("get_cashflow_summary_by_period", {
        _organization_id: currentOrg?.id ?? null,
        _from: fromStr,
        _to: toStr,
      });
      if (error) throw error;
      return (data as unknown as CashflowSummary) ?? EMPTY;
    },
    placeholderData: keepPreviousData,
    ...cachePresets.operational,
  });

  return {
    summary: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isInitialLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
  };
}
