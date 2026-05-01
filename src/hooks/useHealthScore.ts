import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useHealthScore(orgId: string | null) {
  return useQuery({
    queryKey: ["health_score", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compute_health_score" as any, { _org_id: orgId });
      if (error) throw error;
      return data as unknown as number;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecomputeAllHealthScores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("recompute_all_health_scores" as any);
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backoffice_orgs"] });
      qc.invalidateQueries({ queryKey: ["health_score"] });
    },
  });
}

export function healthTone(score: number | null | undefined): {
  label: string;
  cls: string;
  bg: string;
} {
  if (score == null) return { label: "—", cls: "text-muted-foreground", bg: "bg-muted" };
  if (score >= 80) return { label: "Saudável", cls: "text-emerald-500", bg: "bg-emerald-500/10" };
  if (score >= 50) return { label: "Atenção", cls: "text-amber-500", bg: "bg-amber-500/10" };
  return { label: "Risco", cls: "text-destructive", bg: "bg-destructive/10" };
}
