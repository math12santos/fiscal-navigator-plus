import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization } from "@/contexts/OrganizationContext";

/**
 * Returns the org IDs to use in data queries.
 * When holding mode is active, returns all subsidiary IDs + current.
 * Otherwise returns just the current org ID.
 */
export function useActiveOrgIds() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  
  return {
    orgId: currentOrg?.id ?? null,
    /** Use this for queries — it's either [currentOrg] or [currentOrg + subsidiaries] */
    activeOrgIds,
    /** Whether we're in holding mode (multi-org) */
    isMultiOrg: holdingMode,
  };
}
