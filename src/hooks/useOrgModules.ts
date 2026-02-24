import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface OrgModule {
  id: string;
  organization_id: string;
  module_key: string;
  enabled: boolean;
  created_at: string;
}

/**
 * Fetches enabled modules for the current organization.
 * If no records exist in organization_modules for this org, it means
 * the org hasn't gone through module selection (all modules considered active for backward compat).
 */
export function useOrgModules(orgId?: string) {
  const { currentOrg } = useOrganization();
  const resolvedOrgId = orgId || currentOrg?.id;

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["organization_modules", resolvedOrgId],
    queryFn: async () => {
      if (!resolvedOrgId) return [];
      const { data, error } = await supabase
        .from("organization_modules" as any)
        .select("*")
        .eq("organization_id", resolvedOrgId);
      if (error) throw error;
      return (data ?? []) as unknown as OrgModule[];
    },
    enabled: !!resolvedOrgId,
    staleTime: 30_000,
  });

  const hasModuleConfig = modules.length > 0;

  const isModuleEnabled = (moduleKey: string): boolean => {
    // If org has no module config, default all to enabled (backward compat)
    if (!hasModuleConfig) return true;
    const mod = modules.find((m) => m.module_key === moduleKey);
    return mod ? mod.enabled : false;
  };

  const enabledModuleKeys = hasModuleConfig
    ? modules.filter((m) => m.enabled).map((m) => m.module_key)
    : null; // null = all enabled

  return {
    modules,
    isLoading,
    hasModuleConfig,
    isModuleEnabled,
    enabledModuleKeys,
  };
}

/** Mutation to upsert organization modules from Backoffice */
export function useUpsertOrgModule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organization_id,
      module_key,
      enabled,
    }: {
      organization_id: string;
      module_key: string;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from("organization_modules" as any)
        .upsert(
          { organization_id, module_key, enabled },
          { onConflict: "organization_id,module_key" }
        );
      if (error) throw error;
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["organization_modules", vars.organization_id] });
    },
  });
}
