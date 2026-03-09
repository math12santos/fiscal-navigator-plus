import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface StepConfig {
  id: string;
  step_number: number;
  config: Record<string, any>;
  updated_at: string;
  updated_by: string | null;
}

export function useOnboardingConfig() {
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["onboarding-step-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_step_config" as any)
        .select("*")
        .order("step_number");
      if (error) throw error;
      return (data as any[]) as StepConfig[];
    },
  });

  const getStepConfig = (stepNumber: number): Record<string, any> | null => {
    const found = configs?.find((c) => c.step_number === stepNumber);
    return found?.config || null;
  };

  const saveStepConfig = useMutation({
    mutationFn: async ({ stepNumber, config }: { stepNumber: number; config: Record<string, any> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("onboarding_step_config" as any)
        .update({ config, updated_at: new Date().toISOString(), updated_by: user?.id } as any)
        .eq("step_number", stepNumber);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-step-config"] });
      toast({ title: "Configuração salva" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  return { configs, isLoading, getStepConfig, saveStepConfig };
}
