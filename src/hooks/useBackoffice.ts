import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BackofficeOrg {
  id: string;
  name: string;
  document_number: string;
  document_type: string;
  logo_url: string | null;
  status: string;
  plano: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  onboarding_completed: boolean;
}

export interface BackofficeUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  cargo: string | null;
  active: boolean;
  roles: string[];
  memberships: { organization_id: string; role: string; org_name: string }[];
}

// Fetch all organizations (master only)
export function useBackofficeOrgs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["backoffice_orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as BackofficeOrg[];
    },
    enabled: !!user,
  });
}

// Fetch org member count
export function useBackofficeOrgMembers(orgId?: string) {
  return useQuery({
    queryKey: ["backoffice_org_members", orgId],
    queryFn: async () => {
      const query = supabase.from("organization_members").select("*");
      if (orgId) {
        query.eq("organization_id", orgId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });
}

// Fetch all member counts per org
export function useBackofficeOrgMemberCounts() {
  return useQuery({
    queryKey: ["backoffice_org_member_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m: any) => {
        counts[m.organization_id] = (counts[m.organization_id] || 0) + 1;
      });
      return counts;
    },
  });
}

// Fetch user permissions for an org
export function useBackofficePermissions(orgId: string, userId?: string) {
  return useQuery({
    queryKey: ["backoffice_permissions", orgId, userId],
    queryFn: async () => {
      let query = supabase.from("user_permissions").select("*").eq("organization_id", orgId);
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

// Update org
export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<BackofficeOrg>) => {
      const { error } = await supabase
        .from("organizations")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backoffice_orgs"] }),
  });
}

// Manage user permissions
export function useManagePermissions() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const upsertPermission = useMutation({
    mutationFn: async (perm: {
      user_id: string;
      organization_id: string;
      module: string;
      tab?: string | null;
      allowed: boolean;
    }) => {
      // Try update first, then insert
      let query = supabase
        .from("user_permissions")
        .select("id")
        .eq("user_id", perm.user_id)
        .eq("organization_id", perm.organization_id)
        .eq("module", perm.module);
      if (perm.tab) {
        query = query.eq("tab", perm.tab);
      } else {
        query = query.is("tab", null);
      }
      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update({ allowed: perm.allowed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .insert({
            ...perm,
            granted_by: user!.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backoffice_permissions"] }),
  });

  const clonePermissions = useMutation({
    mutationFn: async ({ sourceUserId, targetUserId, orgId }: { sourceUserId: string; targetUserId: string; orgId: string }) => {
      // Get source permissions
      const { data: sourcePerms, error: fetchErr } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", sourceUserId)
        .eq("organization_id", orgId);
      if (fetchErr) throw fetchErr;

      // Delete target existing permissions
      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", targetUserId)
        .eq("organization_id", orgId);

      // Insert cloned
      if (sourcePerms && sourcePerms.length > 0) {
        const newPerms = sourcePerms.map((p) => ({
          user_id: targetUserId,
          organization_id: orgId,
          module: p.module,
          tab: p.tab,
          allowed: p.allowed,
          granted_by: user!.id,
        }));
        const { error } = await supabase.from("user_permissions").insert(newPerms);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backoffice_permissions"] }),
  });

  return { upsertPermission, clonePermissions };
}

// Audit log queries
export function useBackofficeAuditLog(orgId?: string) {
  return useQuery({
    queryKey: ["backoffice_audit", orgId],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (orgId) query = query.eq("organization_id", orgId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Manage user roles
export function useManageUserRoles() {
  const qc = useQueryClient();

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backoffice"] }),
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backoffice"] }),
  });

  return { addRole, removeRole };
}
