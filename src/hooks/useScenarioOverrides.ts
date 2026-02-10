import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface ScenarioOverride {
  id: string;
  scenario_id: string;
  account_id: string | null;
  cost_center_id: string | null;
  override_type: string; // percentual | absoluto
  valor: number;
  notes: string | null;
  organization_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type ScenarioOverrideInput = Omit<ScenarioOverride, "id" | "user_id" | "organization_id" | "created_at" | "updated_at">;

export function useScenarioOverrides(scenarioId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["scenario_overrides", orgId, scenarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenario_overrides" as any)
        .select("*")
        .eq("scenario_id", scenarioId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ScenarioOverride[];
    },
    enabled: !!user && !!orgId && !!scenarioId,
  });

  const create = useMutation({
    mutationFn: async (input: ScenarioOverrideInput) => {
      const { error } = await supabase
        .from("scenario_overrides" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario_overrides", orgId, scenarioId] });
      toast({ title: "Override adicionado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<ScenarioOverrideInput>) => {
      const { error } = await supabase
        .from("scenario_overrides" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario_overrides", orgId, scenarioId] });
      toast({ title: "Override atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scenario_overrides" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario_overrides", orgId, scenarioId] });
      toast({ title: "Override removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return {
    overrides: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
