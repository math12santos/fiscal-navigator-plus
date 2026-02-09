import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface ContractAdjustment {
  id: string;
  contract_id: string;
  data_reajuste: string;
  tipo: string;
  indice_aplicado: string | null;
  percentual: number;
  valor_anterior: number;
  valor_novo: number;
  observacao: string | null;
  created_at: string;
}

export function useContractAdjustments(contractId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["contract_adjustments", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_adjustments" as any)
        .select("*")
        .eq("contract_id", contractId!)
        .order("data_reajuste", { ascending: false });
      if (error) throw error;
      return data as unknown as ContractAdjustment[];
    },
    enabled: !!user && !!contractId,
  });

  const create = useMutation({
    mutationFn: async (adj: Omit<ContractAdjustment, "id" | "created_at">) => {
      const { error } = await supabase.from("contract_adjustments" as any).insert({
        ...adj,
        user_id: user!.id,
        organization_id: orgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_adjustments", contractId] });
      qc.invalidateQueries({ queryKey: ["contracts", orgId] });
      toast({ title: "Reajuste registrado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { adjustments: query.data ?? [], isLoading: query.isLoading, create };
}
