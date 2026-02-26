import { useUserDataScope } from "@/hooks/useUserDataScope";
import { useCostCenters } from "@/hooks/useCostCenters";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { useMemo } from "react";

/**
 * Shows a subtle badge when the current user has scope restrictions,
 * indicating which cost centers they can see.
 */
export function ScopeIndicator() {
  const { hasFullScope, allowedCostCenterIds } = useUserDataScope();
  const { costCenters } = useCostCenters();

  const allowedNames = useMemo(() => {
    if (hasFullScope || allowedCostCenterIds.length === 0) return [];
    return costCenters
      .filter((cc) => allowedCostCenterIds.includes(cc.id))
      .map((cc) => cc.name);
  }, [hasFullScope, allowedCostCenterIds, costCenters]);

  if (hasFullScope) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/50 border border-border/50">
      <Filter size={12} className="text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
        {allowedNames.length > 0
          ? allowedNames.join(", ")
          : "Escopo restrito"}
      </span>
    </div>
  );
}
