import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface ContractInstallment {
  id: string;
  contract_id: string;
  organization_id: string | null;
  user_id: string;
  descricao: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  status: string;
  created_at: string;
}

export type InstallmentInput = Omit<ContractInstallment, "id" | "created_at" | "user_id" | "organization_id">;

export function useContractInstallments(contractId: string | null | undefined) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["contract_installments", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_installments" as any)
        .select("*")
        .eq("contract_id", contractId!)
        .order("numero", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ContractInstallment[];
    },
    enabled: !!user && !!contractId,
  });

  const create = useMutation({
    mutationFn: async (input: InstallmentInput) => {
      const { error } = await supabase.from("contract_installments" as any).insert({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_installments", contractId] });
      toast({ title: "Parcela adicionada" });
    },
    onError: (e: any) => toast({ title: "Erro ao adicionar parcela", description: e.message, variant: "destructive" }),
  });

  const createMany = useMutation({
    mutationFn: async (inputs: InstallmentInput[]) => {
      const rows = inputs.map((input) => ({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      }));
      const { error } = await supabase.from("contract_installments" as any).insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_installments", contractId] });
      toast({ title: "Parcelas geradas com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao gerar parcelas", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<InstallmentInput>) => {
      const { error } = await supabase.from("contract_installments" as any).update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_installments", contractId] });
      qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
      qc.invalidateQueries({ queryKey: ["cashflow_installments"] });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar parcela", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_installments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_installments", contractId] });
      toast({ title: "Parcela removida" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover parcela", description: e.message, variant: "destructive" }),
  });

  const removeAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contract_installments" as any).delete().eq("contract_id", contractId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_installments", contractId] });
    },
    onError: (e: any) => toast({ title: "Erro ao remover parcelas", description: e.message, variant: "destructive" }),
  });

  return {
    installments: query.data ?? [],
    isLoading: query.isLoading,
    create,
    createMany,
    update,
    remove,
    removeAll,
  };
}
