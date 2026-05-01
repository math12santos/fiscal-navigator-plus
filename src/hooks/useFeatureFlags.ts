import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlag {
  id: string;
  flag_key: string;
  scope: "global" | "org" | "plan";
  organization_id: string | null;
  plan_id: string | null;
  enabled: boolean;
  rollout_pct: number;
  value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature_flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags" as any)
        .select("*")
        .order("flag_key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FeatureFlag[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<FeatureFlag> & { flag_key: string; scope: FeatureFlag["scope"] }) => {
      const payload: any = {
        flag_key: input.flag_key,
        scope: input.scope,
        organization_id: input.organization_id ?? null,
        plan_id: input.plan_id ?? null,
        enabled: input.enabled ?? false,
        rollout_pct: input.rollout_pct ?? 0,
        value: input.value ?? {},
        description: input.description ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from("feature_flags" as any).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feature_flags" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature_flags"] }),
  });
}

export function useDeleteFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feature_flags" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature_flags"] }),
  });
}
