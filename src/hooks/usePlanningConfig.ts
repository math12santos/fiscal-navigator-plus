import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface PlanningConfig {
  id: string;
  organization_id: string | null;
  user_id: string;
  saldo_minimo: number;
  colchao_liquidez: number;
  runway_alerta_meses: number;
  created_at: string;
  updated_at: string;
}

export function usePlanningConfig() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["planning_config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planning_config" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PlanningConfig | null;
    },
    enabled: !!user && !!orgId,
  });

  const upsert = useMutation({
    mutationFn: async (input: { saldo_minimo: number; colchao_liquidez: number; runway_alerta_meses: number }) => {
      const { error } = await supabase
        .from("planning_config" as any)
        .upsert({
          ...input,
          organization_id: orgId,
          user_id: user!.id,
        } as any, { onConflict: "organization_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning_config", orgId] });
      toast({ title: "Configuração salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    upsert,
  };
}
