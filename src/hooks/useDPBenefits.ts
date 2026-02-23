import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useDPBenefits() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["dp_benefits", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dp_benefits")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
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
  return useQuery({
    queryKey: ["employee_benefits", currentOrg?.id, employeeId],
    queryFn: async () => {
      let q = supabase
        .from("employee_benefits")
        .select("*, dp_benefits(name, type, default_value)")
        .eq("organization_id", currentOrg!.id);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
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
