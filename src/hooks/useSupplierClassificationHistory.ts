import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

interface SupplierSuggestion {
  suggestedAccountId: string | null;
  suggestedCostCenterId: string | null;
  isLoading: boolean;
}

/**
 * Fetches the most recent classification (account_id, cost_center_id)
 * used for a given supplier (entity_id) in the current organization.
 */
export function useSupplierClassificationHistory(entityId: string | null | undefined): SupplierSuggestion {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["supplier_classification_history", orgId, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashflow_entries")
        .select("account_id, cost_center_id")
        .eq("organization_id", orgId!)
        .eq("entity_id", entityId!)
        .not("account_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as { account_id: string | null; cost_center_id: string | null } | null;
    },
    enabled: !!orgId && !!entityId,
    staleTime: 60_000,
  });

  return {
    suggestedAccountId: data?.account_id ?? null,
    suggestedCostCenterId: data?.cost_center_id ?? null,
    isLoading,
  };
}
