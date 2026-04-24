import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";

export function useDPBenefits() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  const orgIds = holdingMode && activeOrgIds.length > 0 ? activeOrgIds : currentOrg?.id ? [currentOrg.id] : [];

  return useQuery({
    queryKey: ["dp_benefits", orgIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dp_benefits")
        .select("*")
        .in("organization_id", orgIds)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: orgIds.length > 0,
  });
}

export function useMutateDPBenefit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (b: any) => {
      const { error } = await supabase.from("dp_benefits").insert({
        ...b,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dp_benefits"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("dp_benefits").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dp_benefits"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dp_benefits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dp_benefits"] }),
  });

  return { create, update, remove };
}

export function useEmployeeBenefits(employeeId?: string) {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  const orgIds = holdingMode && activeOrgIds.length > 0 ? activeOrgIds : currentOrg?.id ? [currentOrg.id] : [];

  return useQuery({
    queryKey: ["employee_benefits", orgIds, employeeId],
    queryFn: async () => {
      let q = supabase
        .from("employee_benefits")
        .select("*, dp_benefits(name, type, default_value, category)")
        .in("organization_id", orgIds);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: orgIds.length > 0,
  });
}

export function useMutateEmployeeBenefit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const assign = useMutation({
    mutationFn: async (items: { employee_id: string; benefit_id: string; custom_value?: number }[]) => {
      const rows = items.map((i) => ({
        ...i,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      }));
      const { error } = await supabase.from("employee_benefits").upsert(rows, { onConflict: "employee_id,benefit_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee_benefits"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_benefits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee_benefits"] }),
  });

  return { assign, remove };
}
