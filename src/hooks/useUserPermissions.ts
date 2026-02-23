import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Permission {
  module: string;
  tab: string | null;
  allowed: boolean;
}

export function useUserPermissions() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["user_permissions", user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return [];
      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, tab, allowed")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrg.id);
      if (error) throw error;
      return (data ?? []) as Permission[];
    },
    enabled: !!user && !!currentOrg,
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

  // Owners always have full access
  const isOwner = currentRole === "owner";

  const canAccessModule = (moduleKey: string): boolean => {
    if (isMaster || isOwner) return true;
    // If no permissions exist at all, default to full access (backwards compat)
    if (permissions.length === 0) return true;
    // Check module-level permission (tab is null)
    const modulePerm = permissions.find(
      (p) => p.module === moduleKey && p.tab === null
    );
    if (modulePerm) return modulePerm.allowed;
    // If no explicit module-level permission, check if any tab is allowed
    const tabPerms = permissions.filter((p) => p.module === moduleKey && p.tab !== null);
    if (tabPerms.length > 0) return tabPerms.some((p) => p.allowed);
    // No permission record means allowed by default
    return true;
  };

  const canAccessTab = (moduleKey: string, tabKey: string): boolean => {
    if (isMaster || isOwner) return true;
    if (permissions.length === 0) return true;
    const tabPerm = permissions.find(
      (p) => p.module === moduleKey && p.tab === tabKey
    );
    if (tabPerm) return tabPerm.allowed;
    // No explicit tab permission — check module-level
    return canAccessModule(moduleKey);
  };

  const getAllowedTabs = (moduleKey: string, allTabs: { key: string; label: string }[]) => {
    if (isMaster || isOwner) return allTabs;
    if (permissions.length === 0) return allTabs;
    return allTabs.filter((t) => canAccessTab(moduleKey, t.key));
  };

  return {
    permissions,
    isLoading,
    isMaster,
    isOwner,
    canAccessModule,
    canAccessTab,
    getAllowedTabs,
  };
}
