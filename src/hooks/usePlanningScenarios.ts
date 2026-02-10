import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface PlanningScenario {
  id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  type: string;
  description: string | null;
  is_active: boolean;
  variacao_receita: number;
  variacao_custos: number;
  atraso_recebimento_dias: number;
  created_at: string;
  updated_at: string;
}

export type ScenarioInput = Omit<PlanningScenario, "id" | "user_id" | "organization_id" | "created_at" | "updated_at">;

export function usePlanningScenarios() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["planning_scenarios", orgId],
    queryFn: async () => {
      let q = supabase
        .from("planning_scenarios" as any)
        .select("*")
        .order("type", { ascending: true });
      if (orgId) q = q.eq("organization_id", orgId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PlanningScenario[];
    },
    enabled: !!user && !!orgId,
  });

  const create = useMutation({
    mutationFn: async (input: ScenarioInput) => {
      const { data, error } = await supabase
        .from("planning_scenarios" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PlanningScenario;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning_scenarios", orgId] });
      toast({ title: "Cenário criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<ScenarioInput>) => {
      const { error } = await supabase
        .from("planning_scenarios" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning_scenarios", orgId] });
      toast({ title: "Cenário atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planning_scenarios" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning_scenarios", orgId] });
      toast({ title: "Cenário removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!user || !orgId) throw new Error("Usuário/org não definidos");
      const defaults: Omit<ScenarioInput, "is_active">[] = [
        { name: "Base", type: "base", description: "Cenário realista baseado no histórico", variacao_receita: 0, variacao_custos: 0, atraso_recebimento_dias: 0 },
        { name: "Otimista", type: "otimista", description: "Crescimento acelerado de receita", variacao_receita: 15, variacao_custos: 5, atraso_recebimento_dias: 0 },
        { name: "Conservador", type: "conservador", description: "Receita estável com custos crescentes", variacao_receita: -5, variacao_custos: 10, atraso_recebimento_dias: 15 },
        { name: "Stress", type: "stress", description: "Perda de receita e atraso em recebimentos", variacao_receita: -20, variacao_custos: 15, atraso_recebimento_dias: 30 },
      ];
      const { error } = await supabase
        .from("planning_scenarios" as any)
        .insert(defaults.map((d) => ({ ...d, is_active: true, user_id: user.id, organization_id: orgId })) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning_scenarios", orgId] });
      toast({ title: "Cenários padrão criados" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return {
    scenarios: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
    seedDefaults,
  };
}
