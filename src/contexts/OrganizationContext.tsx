import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    try {
      // Get memberships
      const { data: memberships, error: memErr } = await supabase
        .from("organization_members" as any)
        .select("organization_id, role")
        .eq("user_id", user.id);

      if (memErr) throw memErr;
      const mems = memberships as unknown as { organization_id: string; role: string }[];

      if (mems.length === 0) {
        setOrganizations([]);
        setCurrentOrgState(null);
        setCurrentRole(null);
        setLoading(false);
        return;
      }

      const orgIds = mems.map((m) => m.organization_id);
      const { data: orgs, error: orgErr } = await supabase
        .from("organizations" as any)
        .select("*")
        .in("id", orgIds)
        .order("name");

      if (orgErr) throw orgErr;
      const orgList = orgs as unknown as Organization[];
      setOrganizations(orgList);

      // Restore last selected org
      const savedOrgId = localStorage.getItem(STORAGE_KEY);
      const savedOrg = orgList.find((o) => o.id === savedOrgId);
      const selected = savedOrg || orgList[0];

      if (selected) {
        setCurrentOrgState(selected);
        const mem = mems.find((m) => m.organization_id === selected.id);
        setCurrentRole(mem?.role ?? null);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Error fetching organizations:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [user]);

  const setCurrentOrg = (org: Organization) => {
    setCurrentOrgState(org);
    localStorage.setItem(STORAGE_KEY, org.id);
    // Update role
    supabase
      .from("organization_members" as any)
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", user?.id)
      .maybeSingle()
      .then(({ data }) => {
        setCurrentRole((data as any)?.role ?? null);
      });
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        currentRole,
        loading,
        setCurrentOrg,
        refetch: fetchOrgs,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
