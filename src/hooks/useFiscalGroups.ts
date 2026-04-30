import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cachePresets } from "@/lib/cachePresets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface FiscalGroup {
  id: string;
  organization_id: string | null;
  name: string;
  type: string;
  is_default: boolean;
  user_id: string;
  created_at: string;
}

export function useFiscalGroups() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const key = ["fiscal_groups", orgId];

  const { data: groups = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fiscal_groups")
        .select("*")
        .or(`is_default.eq.true,organization_id.eq.${orgId}`)
        .order("name");
      if (error) throw error;
      return data as FiscalGroup[];
    },
    ...cachePresets.reference,
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await (supabase as any).from("fiscal_groups").insert({
        name,
        type: "ambos",
        organization_id: orgId,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { groups, isLoading, create };
}
