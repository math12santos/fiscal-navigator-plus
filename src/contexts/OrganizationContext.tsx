import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cachePresets } from "@/lib/cachePresets";

export interface Organization {
  id: string;
  name: string;
  document_type: string;
  document_number: string;
  logo_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  currentRole: string | null;
  loading: boolean;
  setCurrentOrg: (org: Organization) => void;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizations: [],
  currentOrg: null,
  currentRole: null,
  loading: true,
  setCurrentOrg: () => {},
  refetch: async () => {},
});

export const useOrganization = () => useContext(OrganizationContext);

const STORAGE_KEY = "fincore_current_org";

interface OrgsBundle {
  orgs: Organization[];
  membershipsByOrg: Record<string, string>; // org_id -> role
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );

  const query = useQuery({
    queryKey: ["organizationsBundle", user?.id],
    queryFn: async (): Promise<OrgsBundle> => {
      if (!user) return { orgs: [], membershipsByOrg: {} };

      const { data: memberships, error: memErr } = await supabase
        .from("organization_members" as any)
        .select("organization_id, role")
        .eq("user_id", user.id);
      if (memErr) throw memErr;

      const mems = (memberships as unknown as { organization_id: string; role: string }[]) ?? [];
      if (mems.length === 0) return { orgs: [], membershipsByOrg: {} };

      const orgIds = mems.map((m) => m.organization_id);
      const { data: orgs, error: orgErr } = await supabase
        .from("organizations" as any)
        .select("id,name,document_type,document_number,logo_url,created_by,created_at,updated_at,onboarding_completed")
        .in("id", orgIds)
        .order("name");
      if (orgErr) throw orgErr;

      const membershipsByOrg: Record<string, string> = {};
      mems.forEach((m) => {
        membershipsByOrg[m.organization_id] = m.role;
      });

      return {
        orgs: (orgs as unknown as Organization[]) ?? [],
        membershipsByOrg,
      };
    },
    enabled: !!user,
    ...cachePresets.static,
  });

  const organizations = query.data?.orgs ?? [];
  const membershipsByOrg = query.data?.membershipsByOrg ?? {};

  // Auto-select current org once data arrives
  useEffect(() => {
    if (!organizations.length) return;
    if (currentOrgId && organizations.some((o) => o.id === currentOrgId)) return;
    const fallback = organizations[0]?.id ?? null;
    if (fallback) {
      setCurrentOrgId(fallback);
      localStorage.setItem(STORAGE_KEY, fallback);
    }
  }, [organizations, currentOrgId]);

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === currentOrgId) ?? null,
    [organizations, currentOrgId]
  );
  const currentRole = currentOrgId ? membershipsByOrg[currentOrgId] ?? null : null;

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgId(org.id);
    localStorage.setItem(STORAGE_KEY, org.id);
  }, []);

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["organizationsBundle", user?.id] });
  }, [qc, user?.id]);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        currentRole,
        loading: query.isLoading,
        setCurrentOrg,
        refetch,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
