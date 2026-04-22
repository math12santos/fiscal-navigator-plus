import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgModules } from "@/hooks/useOrgModules";
import { useCostCenterPermissionsBulk } from "@/hooks/useCostCenterPermissions";

interface Permission {
  module: string;
  tab: string | null;
  allowed: boolean;
}

export function useUserPermissions() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { isModuleEnabled: isOrgModuleEnabled, isLoading: orgModulesLoading } = useOrgModules();
  const orgId = currentOrg?.id;

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["user_permissions", user?.id, orgId],
    queryFn: async () => {
      if (!user || !orgId) return [];
      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, tab, allowed")
        .eq("user_id", user.id)
        .eq("organization_id", orgId);
      if (error) throw error;
      return (data ?? []) as Permission[];
    },
    enabled: !!user && !!orgId,
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
  });

  // Check if user is a backoffice operator with access to this org
  const { data: isBackofficeUser = false } = useQuery({
    queryKey: ["is_backoffice", user?.id, orgId],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("backoffice_users" as any)
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) return false;
      const role = (data as any).role;
      // master/backoffice_admin have access to all orgs
      if (role === "master" || role === "backoffice_admin") return true;
      // operators need specific org access
      if (!orgId) return false;
      const { data: access } = await supabase
        .from("backoffice_organization_access" as any)
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .maybeSingle();
      return !!access;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // Owners and admins always have full access
  const isOwner = currentRole === "owner";
  const isAdmin = currentRole === "admin";
  const hasFullAccess = isMaster || isOwner || isAdmin || isBackofficeUser;

  // Inline cost center access (avoid circular dep with useUserDataScope)
  const { data: ccAccessIds = [] } = useQuery({
    queryKey: ["user_cost_center_access_ids", user?.id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cost_center_access" as any)
        .select("cost_center_id")
        .eq("user_id", user!.id)
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []).map((d: any) => d.cost_center_id as string);
    },
    enabled: !!user && !!orgId && !hasFullAccess,
    staleTime: 5 * 60_000,
  });

  const hasFullScope = hasFullAccess || ccAccessIds.length === 0;

  // Fetch cost center permissions for user's allowed CCs
  const { permissions: ccPermissions, isLoading: ccPermLoading } = useCostCenterPermissionsBulk(
    hasFullScope ? [] : ccAccessIds
  );

  // Filter out meta-permissions (scope, action) to check if real module perms exist
  const hasConfiguredPermissions = permissions.some(
    (p) => !["scope", "action"].includes(p.module)
  );

  // Check if any CC has configured permissions (restrictive mode)
  const hasCCPermissions = ccPermissions.length > 0;

  /**
   * Check if a module/tab is allowed via cost center permissions.
   * Union logic: if ANY of the user's CCs allows, it's allowed.
   */
  const isCCAllowed = (moduleKey: string, tabKey?: string | null): boolean => {
    if (hasFullScope || !hasCCPermissions) return true;
    if (tabKey) {
      const tabPerms = ccPermissions.filter(
        (p) => p.module_key === moduleKey && p.tab_key === tabKey && p.allowed
      );
      if (tabPerms.length > 0) return true;
      const modPerms = ccPermissions.filter(
        (p) => p.module_key === moduleKey && p.tab_key === null && p.allowed
      );
      return modPerms.length > 0;
    }
    return ccPermissions.some((p) => p.module_key === moduleKey && p.allowed);
  };

  const canAccessModule = (moduleKey: string): boolean => {
    if (!isOrgModuleEnabled(moduleKey)) return false;
    if ((isLoading || orgModulesLoading) && !hasFullAccess) return false;
    if (hasFullAccess) return true;

    // Check user-level override first
    if (hasConfiguredPermissions) {
      const modulePerm = permissions.find((p) => p.module === moduleKey && p.tab === null);
      if (modulePerm) return modulePerm.allowed;
      const tabPerms = permissions.filter((p) => p.module === moduleKey && p.tab !== null);
      if (tabPerms.length > 0) return tabPerms.some((p) => p.allowed);
    }

    // Check CC-level permissions
    if (!hasFullScope && hasCCPermissions) return isCCAllowed(moduleKey);

    // If no user permissions and no CC permissions, deny
    if (!hasConfiguredPermissions) return false;

    return false;
  };

  const canAccessTab = (moduleKey: string, tabKey: string): boolean => {
    if (!isOrgModuleEnabled(moduleKey)) return false;
    if (hasFullAccess) return true;

    // User-level override
    if (hasConfiguredPermissions) {
      // Check explicit tab permission first
      const tabPerm = permissions.find((p) => p.module === moduleKey && p.tab === tabKey);
      if (tabPerm) return tabPerm.allowed;

      // If there are explicit tab perms for this module but NOT for this tab,
      // fall back to the module-level permission (allow-by-default for unlisted tabs)
      const modulePerm = permissions.find((p) => p.module === moduleKey && p.tab === null);
      if (modulePerm) return modulePerm.allowed;

      // No module-level perm either — check if any tab is allowed
      const hasAnyTabPerms = permissions.some((p) => p.module === moduleKey && p.tab !== null);
      if (hasAnyTabPerms) return false;

      return false;
    }

    // CC-level
    if (!hasFullScope && hasCCPermissions) return isCCAllowed(moduleKey, tabKey);

    return canAccessModule(moduleKey);
  };

  const getAllowedTabs = (moduleKey: string, allTabs: { key: string; label: string }[]) => {
    if (!isOrgModuleEnabled(moduleKey)) return [];
    if (hasFullAccess) return allTabs;
    return allTabs.filter((t) => canAccessTab(moduleKey, t.key));
  };

  return {
    permissions,
    isLoading: isLoading || orgModulesLoading || ccPermLoading,
    isMaster,
    isOwner,
    isBackofficeUser,
    hasFullAccess,
    canAccessModule,
    canAccessTab,
    getAllowedTabs,
  };
}
