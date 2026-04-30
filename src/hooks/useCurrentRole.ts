/**
 * Single source of truth for the current user's app-level role.
 *
 * Replaces 3 duplicated `user_roles?role=master` fetches that were spread
 * across AuthRoute, BackofficeRoutes and ad-hoc checks. All consumers now
 * share the same React Query cache entry.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cachePresets } from "@/lib/cachePresets";

export type AppRole = "master" | "admin" | "moderator" | "user" | null;

export function useCurrentRole() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["currentUserRoles", user?.id],
    queryFn: async (): Promise<AppRole[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.role as AppRole);
    },
    enabled: !!user,
    ...cachePresets.static,
  });

  const roles = query.data ?? [];
  return {
    roles,
    isMaster: roles.includes("master"),
    isAdmin: roles.includes("admin"),
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
