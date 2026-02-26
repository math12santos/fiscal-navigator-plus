import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface CostCenterPermission {
  id: string;
  organization_id: string;
  cost_center_id: string;
  module_key: string;
  tab_key: string | null;
  role: string;
  allowed: boolean;
  created_at: string;
}

export function useCostCenterPermissions(costCenterId?: string | null) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["cost_center_permissions", costCenterId],
    queryFn: async () => {
      if (!costCenterId) return [];
      const { data, error } = await supabase
        .from("cost_center_permissions" as any)
        .select("*")
        .eq("cost_center_id", costCenterId);
      if (error) throw error;
      return (data ?? []) as unknown as CostCenterPermission[];
    },
    enabled: !!costCenterId && !!orgId,
    staleTime: 30_000,
  });

  return { permissions, isLoading };
}

/**
 * Save permissions for a cost center: delete old, insert new in batch.
 */
export async function saveCostCenterPermissions(
  costCenterId: string,
  orgId: string,
  permissions: { module_key: string; tab_key: string | null; role: string; allowed: boolean }[]
) {
  // Delete existing
  await supabase
    .from("cost_center_permissions" as any)
    .delete()
    .eq("cost_center_id", costCenterId);

  if (permissions.length === 0) return;

  // Insert new
  const rows = permissions.map((p) => ({
    organization_id: orgId,
    cost_center_id: costCenterId,
    module_key: p.module_key,
    tab_key: p.tab_key,
    role: p.role,
    allowed: p.allowed,
  }));

  const { error } = await supabase
    .from("cost_center_permissions" as any)
    .insert(rows);
  if (error) throw error;
}

/**
 * Fetch all cost_center_permissions for multiple cost centers at once.
 */
export function useCostCenterPermissionsBulk(costCenterIds: string[]) {
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["cost_center_permissions_bulk", costCenterIds.sort().join(",")],
    queryFn: async () => {
      if (costCenterIds.length === 0) return [];
      const { data, error } = await supabase
        .from("cost_center_permissions" as any)
        .select("*")
        .in("cost_center_id", costCenterIds);
      if (error) throw error;
      return (data ?? []) as unknown as CostCenterPermission[];
    },
    enabled: costCenterIds.length > 0,
    staleTime: 30_000,
  });

  return { permissions, isLoading };
}
