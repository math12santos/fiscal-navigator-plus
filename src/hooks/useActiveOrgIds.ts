import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization } from "@/contexts/OrganizationContext";

/**
 * Returns the org IDs to use in data queries.
 * When holding mode is active, returns all subsidiary IDs + current.
 * Otherwise returns just the current org ID.
 */
export function useActiveOrgIds() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds, holdingView, selectedSubsidiaryId } = useHolding();
  
  return {
    orgId: currentOrg?.id ?? null,
    /** Use this for queries — it's either [currentOrg] or [currentOrg + subsidiaries] or [selectedSubsidiary] */
    activeOrgIds,
    /** Whether we're in holding mode (multi-org) */
    isMultiOrg: holdingMode && holdingView === "consolidated",
    /** Whether viewing a specific company in per-company mode */
    isPerCompany: holdingMode && holdingView === "per-company",
    /** The selected subsidiary ID in per-company mode */
    selectedSubsidiaryId,
  };
}
