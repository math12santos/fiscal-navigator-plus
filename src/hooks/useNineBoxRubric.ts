// Hooks da rubrica, scores, fontes e calibração da Matriz 9 Box criteriosa.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { CriterionRow, ScoreRow, SourceRow, SourceKind, Dimension } from "@/lib/performance/scoring";

/** Lista critérios da org + templates de sistema, mesclando a rubrica. */
export function use9BoxCriteria() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["hr_9box_criteria", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_9box_criteria" as any)
        .select("*")
        .or(`organization_id.eq.${currentOrg!.id},organization_id.is.null`)
        .eq("active", true)
        .order("dimension", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as (CriterionRow & {
        organization_id: string | null;
        is_system_template: boolean;
      })[];
      // Se a org já tiver suas próprias linhas, usa as da org. Caso contrário, usa template do sistema.
      const orgRows = rows.filter((r) => r.organization_id === currentOrg!.id);
      const sysRows = rows.filter((r) => r.organization_id == null);
      const desempenho =
        orgRows.some((r) => r.dimension === "desempenho")
          ? orgRows.filter((r) => r.dimension === "desempenho")
          : sysRows.filter((r) => r.dimension === "desempenho");
      const potencial =
        orgRows.some((r) => r.dimension === "potencial")
          ? orgRows.filter((r) => r.dimension === "potencial")
          : sysRows.filter((r) => r.dimension === "potencial");
      return [...desempenho, ...potencial] as CriterionRow[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function use9BoxScores(evaluationId?: string) {
  return useQuery({
    queryKey: ["hr_9box_scores", evaluationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_9box_scores" as any)
        .select("*")
        .eq("evaluation_id", evaluationId!);
      if (error) throw error;
      return (data ?? []) as unknown as ScoreRow[];
    },
    enabled: !!evaluationId,
  });
}

export function use9BoxSources(evaluationId?: string) {
  return useQuery({
    queryKey: ["hr_9box_sources", evaluationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_9box_sources" as any)
        .select("*")
        .eq("evaluation_id", evaluationId!);
      if (error) throw error;
      return (data ?? []) as unknown as (SourceRow & { evaluator_user_id: string | null })[];
    },
    enabled: !!evaluationId,
  });
}

export function useMutate9BoxScore() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (input: {
      evaluation_id: string;
      criterion_id: string;
      source: SourceKind;
      score: number;
      evidence_text?: string | null;
      evidence_url?: string | null;
    }) => {
      const { error } = await supabase.from("hr_9box_scores" as any).upsert(
        {
          ...input,
          organization_id: currentOrg!.id,
        } as any,
        { onConflict: "evaluation_id,criterion_id,source" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hr_9box_scores", vars.evaluation_id] });
    },
  });
}

export function useMutate9BoxSource() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (input: {
      evaluation_id: string;
      source: SourceKind;
      weight: number;
      submitted?: boolean;
      evaluator_user_id?: string | null;
    }) => {
      const { error } = await supabase.from("hr_9box_sources" as any).upsert(
        {
          ...input,
          organization_id: currentOrg!.id,
        } as any,
        { onConflict: "evaluation_id,source" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hr_9box_sources", vars.evaluation_id] });
    },
  });
}

/** Salva consolidado (notas finais + status + confiabilidade + viés). */
export function useFinalize9Box() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      nota_desempenho: number;
      nota_potencial: number;
      confiabilidade: number;
      vies_detectado?: any;
      status: "rascunho" | "em_calibracao" | "calibrada";
      action: string;
      notes?: string;
    }) => {
      const { error: e1 } = await supabase
        .from("hr_9box_evaluations" as any)
        .update({
          nota_desempenho: input.nota_desempenho,
          nota_potencial: input.nota_potencial,
          confiabilidade: input.confiabilidade,
          vies_detectado: input.vies_detectado ?? null,
          status: input.status,
        } as any)
        .eq("id", input.id);
      if (e1) throw e1;
      // Log de calibração quando muda de status
      const { data: ev } = await supabase
        .from("hr_9box_evaluations" as any)
        .select("organization_id")
        .eq("id", input.id)
        .single();
      if (ev) {
        await supabase.from("hr_9box_calibration_log" as any).insert({
          evaluation_id: input.id,
          organization_id: (ev as any).organization_id,
          calibrator_user_id: user!.id,
          action: input.action,
          notes: input.notes ?? null,
        } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_9box"] });
    },
  });
}

export type { CriterionRow, ScoreRow, SourceRow, SourceKind, Dimension };
