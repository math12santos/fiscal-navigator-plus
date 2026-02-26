import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface CostCenterAccess {
  id: string;
  user_id: string;
  organization_id: string;
  cost_center_id: string;
  granted_by: string;
  created_at: string;
}

export function useUserDataScope() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { hasFullAccess } = useUserPermissions();
  const orgId = currentOrg?.id;

  const { data: accessEntries = [], isLoading } = useQuery({
    queryKey: ["user_cost_center_access", user?.id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cost_center_access" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as unknown as CostCenterAccess[];
    },
    enabled: !!user && !!orgId,
    staleTime: 30_000,
  });

  const allowedCostCenterIds = useMemo(
    () => accessEntries.map((e) => e.cost_center_id),
    [accessEntries]
  );

  // hasFullScope: admin/owner/master OR no restrictions configured (backwards compat)
  const hasFullScope = hasFullAccess || allowedCostCenterIds.length === 0;

  /**
   * Filters an array of items by `cost_center_id`.
   * Items without a cost_center_id (null) are always visible.
   * Users with full scope see everything.
   */
  const filterByScope = useCallback(
    <T extends { cost_center_id?: string | null }>(items: T[]): T[] => {
      if (hasFullScope) return items;
      return items.filter(
        (item) => !item.cost_center_id || allowedCostCenterIds.includes(item.cost_center_id)
      );
    },
    [hasFullScope, allowedCostCenterIds]
  );

  return {
    allowedCostCenterIds,
    hasFullScope,
    isLoading,
    filterByScope,
  };
}
