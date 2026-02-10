import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface Liability {
  id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  tipo: string; // divida | contingencia | provisao
  descricao: string | null;
  valor_original: number;
  valor_atualizado: number;
  taxa_juros: number;
  data_inicio: string | null;
  data_vencimento: string | null;
  status: string; // ativo | quitado | negociacao | judicial
  probabilidade: string; // provavel | possivel | remota
  impacto_stress: number;
  entity_id: string | null;
  contract_id: string | null;
  cost_center_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LiabilityInput = Omit<Liability, "id" | "user_id" | "organization_id" | "created_at" | "updated_at">;

export function useLiabilities() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["liabilities", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liabilities" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Liability[];
    },
    enabled: !!user && !!orgId,
  });

  const create = useMutation({
    mutationFn: async (input: LiabilityInput) => {
      const { data, error } = await supabase
        .from("liabilities" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Liability;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["liabilities", orgId] });
      toast({ title: "Passivo registrado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<LiabilityInput>) => {
      const { error } = await supabase
        .from("liabilities" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["liabilities", orgId] });
      toast({ title: "Passivo atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("liabilities" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["liabilities", orgId] });
      toast({ title: "Passivo removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Computed totals
  const totals = (query.data ?? []).reduce(
    (acc, l) => {
      if (l.status === "quitado") return acc;
      acc.total += Number(l.valor_atualizado);
      if (l.tipo === "divida") acc.dividas += Number(l.valor_atualizado);
      if (l.tipo === "contingencia") {
        if (l.probabilidade === "provavel") acc.contingencias_provaveis += Number(l.valor_atualizado);
        else if (l.probabilidade === "possivel") acc.contingencias_possiveis += Number(l.valor_atualizado);
        else acc.contingencias_remotas += Number(l.valor_atualizado);
      }
      if (l.tipo === "provisao") acc.provisoes += Number(l.valor_atualizado);
      // Stress impact
      acc.stress_total += Number(l.valor_atualizado) * (1 + Number(l.impacto_stress) / 100);
      return acc;
    },
    { total: 0, dividas: 0, contingencias_provaveis: 0, contingencias_possiveis: 0, contingencias_remotas: 0, provisoes: 0, stress_total: 0 }
  );

  return {
    liabilities: query.data ?? [],
    isLoading: query.isLoading,
    totals,
    create,
    update,
    remove,
  };
}
