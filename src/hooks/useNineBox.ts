// Hook da Matriz 9 Box.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";

export interface NineBoxEvaluation {
  id: string;
  organization_id: string;
  employee_id: string;
  evaluator_user_id: string;
  data_avaliacao: string;
  nota_desempenho: number;
  nota_potencial: number;
  nivel_desempenho: "baixo" | "medio" | "alto" | null;
  nivel_potencial: "baixo" | "medio" | "alto" | null;
  quadrante: number | null;
  justificativa: string | null;
  pontos_fortes: string | null;
  pontos_atencao: string | null;
  risco_perda: "baixo" | "medio" | "alto";
  indicacao_sucessao: boolean;
  recomendacao: string;
  bsc_score_snapshot: number | null;
  liberado_para_colaborador: boolean;
}

export function useNineBoxEvaluations() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  return useQuery({
    queryKey: ["hr_9box", holdingMode ? activeOrgIds : currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("hr_9box_evaluations" as any).select("*").order("data_avaliacao", { ascending: false });
      if (holdingMode && activeOrgIds.length > 0) q = q.in("organization_id", activeOrgIds);
      else q = q.eq("organization_id", currentOrg!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as NineBoxEvaluation[];
    },
    enabled: !!currentOrg?.id,
  });
}

/**
 * Última avaliação 9 Box por colaborador (mapa employee_id → evaluation).
 */
export function useLatest9BoxByEmployee() {
  const { data: list = [], ...rest } = useNineBoxEvaluations();
  const map = new Map<string, NineBoxEvaluation>();
  for (const ev of list) {
    if (!map.has(ev.employee_id)) map.set(ev.employee_id, ev);
  }
  return { map, list, ...rest };
}

export function useMutateNineBox() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (input: Partial<NineBoxEvaluation>) => {
      const { data, error } = await supabase.from("hr_9box_evaluations" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
        evaluator_user_id: user!.id,
      } as any).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_9box"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<NineBoxEvaluation> & { id: string }) => {
      const { error } = await supabase.from("hr_9box_evaluations" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_9box"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_9box_evaluations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_9box"] }),
  });

  return { create, update, remove };
}
