import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization, Organization } from "@/contexts/OrganizationContext";

type HoldingView = "consolidated" | "per-company";

interface HoldingContextType {
  /** Whether the current org is a holding (has subsidiaries) */
  isHolding: boolean;
  /** Whether holding mode is currently active */
  holdingMode: boolean;
  /** Toggle holding mode on/off */
  setHoldingMode: (v: boolean) => void;
  /** Current view mode when holding mode is active */
  holdingView: HoldingView;
  /** Toggle between consolidated and per-company */
  setHoldingView: (v: HoldingView) => void;
  /** All subsidiary org IDs (recursive) */
  subsidiaryIds: string[];
  /** Subsidiary organizations with their names */
  subsidiaryOrgs: Organization[];
  /** The list of org IDs to query: if holding mode is on, includes current + all subsidiaries; otherwise just current */
  activeOrgIds: string[];
  /** In per-company mode, the currently selected subsidiary ID (null = holding org itself) */
  selectedSubsidiaryId: string | null;
  /** Set the selected subsidiary in per-company mode */
  setSelectedSubsidiaryId: (id: string | null) => void;
  /** Loading state */
  isLoading: boolean;
}

const HoldingContext = createContext<HoldingContextType>({
  isHolding: false,
  holdingMode: false,
  setHoldingMode: () => {},
  holdingView: "consolidated",
  setHoldingView: () => {},
  subsidiaryIds: [],
  subsidiaryOrgs: [],
  activeOrgIds: [],
  selectedSubsidiaryId: null,
  setSelectedSubsidiaryId: () => {},
  isLoading: false,
});

export const useHolding = () => useContext(HoldingContext);

export function HoldingProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const [holdingMode, setHoldingMode] = useState(false);
  const [holdingView, setHoldingView] = useState<HoldingView>("consolidated");
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);

  // Check if current org is a holding
  const holdingQuery = useQuery({
    queryKey: ["is_holding", orgId],
    queryFn: async () => {
      if (!orgId) return { isHolding: false, subsidiaryIds: [], subsidiaryOrgs: [] };

      // Check if org has any subsidiaries
      const { data: holdings, error } = await supabase
        .from("organization_holdings" as any)
        .select("subsidiary_id")
        .eq("holding_id", orgId);

      if (error) throw error;
      const directSubs = (holdings as any[]) ?? [];

      if (directSubs.length === 0) {
        return { isHolding: false, subsidiaryIds: [], subsidiaryOrgs: [] };
      }

      // Get all recursive subsidiary IDs using the DB function
      const { data: allSubs, error: rpcErr } = await supabase.rpc(
        "get_all_subsidiary_ids" as any,
        { p_holding_id: orgId }
      );

      if (rpcErr) throw rpcErr;
      const subIds = ((allSubs as any[]) ?? []).map((r: any) => r);

      // Fetch org details for subsidiaries
      if (subIds.length === 0) {
        return { isHolding: true, subsidiaryIds: [], subsidiaryOrgs: [] };
      }

      const { data: orgs, error: orgErr } = await supabase
        .from("organizations" as any)
        .select("*")
        .in("id", subIds)
        .order("name");

      if (orgErr) throw orgErr;

      return {
        isHolding: true,
        subsidiaryIds: subIds as string[],
        subsidiaryOrgs: (orgs ?? []) as unknown as Organization[],
      };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const isHolding = holdingQuery.data?.isHolding ?? false;
  const subsidiaryIds = holdingQuery.data?.subsidiaryIds ?? [];
  const subsidiaryOrgs = holdingQuery.data?.subsidiaryOrgs ?? [];

  // When holding mode is off or org is not a holding, reset
  const effectiveHoldingMode = isHolding && holdingMode;

  const activeOrgIds = useMemo(() => {
    if (!orgId) return [];
    if (!effectiveHoldingMode) return [orgId];
    // In per-company mode with a selection, narrow to just that org
    if (holdingView === "per-company" && selectedSubsidiaryId !== null) {
      return [selectedSubsidiaryId];
    }
    return [orgId, ...subsidiaryIds];
  }, [orgId, effectiveHoldingMode, subsidiaryIds, holdingView, selectedSubsidiaryId]);

  return (
    <HoldingContext.Provider
      value={{
        isHolding,
        holdingMode: effectiveHoldingMode,
        setHoldingMode,
        holdingView,
        setHoldingView,
        subsidiaryIds,
        subsidiaryOrgs,
        activeOrgIds,
        selectedSubsidiaryId,
        setSelectedSubsidiaryId,
        isLoading: holdingQuery.isLoading,
      }}
    >
      {children}
    </HoldingContext.Provider>
  );
}
