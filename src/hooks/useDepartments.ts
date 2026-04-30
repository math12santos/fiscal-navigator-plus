// Hook de departamentos (RH).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cachePresets } from "@/lib/cachePresets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";

export interface HrDepartment {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  manager_user_id: string | null;
  cost_center_id: string | null;
  active: boolean;
}

export function useDepartments() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  return useQuery({
    queryKey: ["hr_departments", holdingMode ? activeOrgIds : currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("hr_departments" as any).select("*").eq("active", true).order("name");
      if (holdingMode && activeOrgIds.length > 0) q = q.in("organization_id", activeOrgIds);
      else q = q.eq("organization_id", currentOrg!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as HrDepartment[];
    },
    enabled: !!currentOrg?.id,
    ...cachePresets.reference,
  });
}

export function useMutateDepartment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (input: Partial<HrDepartment>) => {
      const { error } = await supabase.from("hr_departments" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_departments"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<HrDepartment> & { id: string }) => {
      const { error } = await supabase.from("hr_departments" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_departments"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete via active=false para preservar referências
      const { error } = await supabase.from("hr_departments" as any).update({ active: false } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_departments"] }),
  });

  return { create, update, remove };
}
