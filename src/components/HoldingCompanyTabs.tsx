import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

/**
 * When holding mode is active and view is "per-company",
 * renders company tabs above the page content.
 * The selected tab updates activeOrgIds via HoldingContext
 * so all hooks automatically filter to that company.
 */
export function HoldingCompanyTabs() {
  const { currentOrg } = useOrganization();
  const {
    holdingMode,
    holdingView,
    subsidiaryOrgs,
    selectedSubsidiaryId,
    setSelectedSubsidiaryId,
  } = useHolding();

  if (!holdingMode || holdingView !== "per-company") return null;

  const allOrgs = [
    { id: currentOrg?.id ?? "", name: currentOrg?.name ?? "Holding" },
    ...subsidiaryOrgs.map((o) => ({ id: o.id, name: o.name })),
  ];

  const activeId = selectedSubsidiaryId ?? currentOrg?.id ?? "";

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 border-b border-border/50">
      {allOrgs.map((org) => (
        <button
          key={org.id}
          onClick={() => setSelectedSubsidiaryId(org.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
            activeId === org.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Building2 size={12} />
          {org.name}
        </button>
      ))}
    </div>
  );
}
