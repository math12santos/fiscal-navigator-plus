import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";

export interface OnboardingProgress {
  id: string;
  organization_id: string;
  current_step: number;
  completed_steps: number[];
  maturity_level: number | null;
  maturity_score: string | null;
  diagnosis_answers: Record<string, any>;
  structure_data: Record<string, any>;
  integrations_data: Record<string, any>;
  financial_structure_data: Record<string, any>;
  contracts_data: Record<string, any>;
  planning_data: Record<string, any>;
  routines_data: Record<string, any>;
  cockpit_activated: boolean;
  assisted_start_date: string | null;
  score_dimensions: Record<string, any>;
  status: string;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  user_id: string;
}

const STEP_DATA_KEYS: Record<number, string> = {
  1: "diagnosis_answers",
  2: "structure_data",
  3: "integrations_data",
  4: "financial_structure_data",
  5: "contracts_data",
  6: "planning_data",
  7: "routines_data",
  10: "score_dimensions",
};

export function useOnboardingProgress() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const orgId = currentOrg?.id;

  const fetchProgress = useCallback(async () => {
    if (!user || !orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("onboarding_progress" as any)
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      if (import.meta.env.DEV) console.error("Error fetching onboarding progress:", error);
    }
    setProgress(data as unknown as OnboardingProgress | null);
    setLoading(false);
  }, [user, orgId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const initProgress = useCallback(async () => {
    if (!user || !orgId) return null;
    const { data, error } = await supabase
      .from("onboarding_progress" as any)
      .insert({
        organization_id: orgId,
        user_id: user.id,
        current_step: 1,
        completed_steps: [],
        status: "em_andamento",
      } as any)
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error("Error creating onboarding progress:", error);
      return null;
    }
    const result = data as unknown as OnboardingProgress;
    setProgress(result);
    return result;
  }, [user, orgId]);

  const saveProgress = useCallback(
    async (updates: Partial<OnboardingProgress>) => {
      if (!progress?.id) return;
      const { error } = await supabase
        .from("onboarding_progress" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", progress.id);

      if (error) {
        if (import.meta.env.DEV) console.error("Error saving onboarding progress:", error);
        toast({ title: "Erro ao salvar progresso", variant: "destructive" });
        return;
      }
      setProgress((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    [progress?.id]
  );

  const debouncedSave = useCallback(
    (updates: Partial<OnboardingProgress>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveProgress(updates), 800);
    },
    [saveProgress]
  );

  const updateStepData = useCallback(
    (step: number, data: Record<string, any>) => {
      const key = STEP_DATA_KEYS[step];
      if (!key) return;
      setProgress((prev) => (prev ? { ...prev, [key]: data } : prev));
      debouncedSave({ [key]: data } as any);
    },
    [debouncedSave]
  );

  const completeStep = useCallback(
    async (step: number) => {
      if (!progress) return;
      const completed = Array.from(new Set([...progress.completed_steps, step])).sort();
      await saveProgress({ completed_steps: completed });
    },
    [progress, saveProgress]
  );

  const goToStep = useCallback(
    async (step: number) => {
      if (!progress) return;
      await saveProgress({ current_step: step });
    },
    [progress, saveProgress]
  );

  const finishOnboarding = useCallback(
    async (maturityScore: string, dimensions: Record<string, number>) => {
      if (!progress) return;
      await saveProgress({
        status: "concluido",
        completed_at: new Date().toISOString(),
        maturity_score: maturityScore,
        score_dimensions: dimensions,
        completed_steps: Array.from(new Set([...progress.completed_steps, 10])).sort(),
      });
    },
    [progress, saveProgress]
  );

  return {
    progress,
    loading,
    initProgress,
    saveProgress,
    updateStepData,
    completeStep,
    goToStep,
    finishOnboarding,
    refetch: fetchProgress,
  };
}
