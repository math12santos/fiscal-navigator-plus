import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgModules } from "@/hooks/useOrgModules";

interface Permission {
  module: string;
  tab: string | null;
  allowed: boolean;
}

export function useUserPermissions() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { isModuleEnabled: isOrgModuleEnabled, isLoading: orgModulesLoading } = useOrgModules();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["user_permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, tab, allowed")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as Permission[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Check if user has a master role (bypasses all permissions)
  const { data: isMaster = false } = useQuery({
    queryKey: ["is_master", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "master")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Owners and admins always have full access
  const isOwner = currentRole === "owner";
  const isAdmin = currentRole === "admin";
  const hasFullAccess = isMaster || isOwner || isAdmin;

  // Filter out meta-permissions (scope, action) to check if real module perms exist
  const hasConfiguredPermissions = permissions.some(
    (p) => !["scope", "action"].includes(p.module)
  );

  const canAccessModule = (moduleKey: string): boolean => {
    // First check: is this module enabled at the organization level?
    if (!isOrgModuleEnabled(moduleKey)) return false;

    // While loading permissions for a new org, block access for non-privileged users
    if ((isLoading || orgModulesLoading) && !hasFullAccess) return false;
    if (hasFullAccess) return true;
    // If no module permissions configured, deny (must be configured via Backoffice)
    if (!hasConfiguredPermissions) return false;
    // Check module-level permission (tab is null)
    const modulePerm = permissions.find(
      (p) => p.module === moduleKey && p.tab === null
    );
    if (modulePerm) return modulePerm.allowed;
    // If no explicit module-level permission, check if any tab is allowed
    const tabPerms = permissions.filter((p) => p.module === moduleKey && p.tab !== null);
    if (tabPerms.length > 0) return tabPerms.some((p) => p.allowed);
    // Module has no permission record but other modules do → denied
    return false;
  };

  const canAccessTab = (moduleKey: string, tabKey: string): boolean => {
    if (!isOrgModuleEnabled(moduleKey)) return false;
    if (hasFullAccess) return true;
    if (!hasConfiguredPermissions) return false;
    const tabPerm = permissions.find(
      (p) => p.module === moduleKey && p.tab === tabKey
    );
    if (tabPerm) return tabPerm.allowed;
    // No explicit tab permission — allow if module is allowed (no tab granularity configured)
    const hasAnyTabPerms = permissions.some((p) => p.module === moduleKey && p.tab !== null);
    if (hasAnyTabPerms) return false;
    return canAccessModule(moduleKey);
  };

  const getAllowedTabs = (moduleKey: string, allTabs: { key: string; label: string }[]) => {
    if (!isOrgModuleEnabled(moduleKey)) return [];
    if (hasFullAccess) return allTabs;
    if (!hasConfiguredPermissions) return [];
    return allTabs.filter((t) => canAccessTab(moduleKey, t.key));
  };

  return {
    permissions,
    isLoading: isLoading || orgModulesLoading,
    isMaster,
    isOwner,
    hasFullAccess,
    canAccessModule,
    canAccessTab,
    getAllowedTabs,
  };
}
