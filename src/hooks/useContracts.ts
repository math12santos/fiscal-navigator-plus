import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Contract {
  id: string;
  nome: string;
  tipo: string;
  valor: number;
  vencimento: string;
  status: string;
  source: string;
  external_ref: string | null;
  notes: string | null;
  created_at: string;
}

export function useContracts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (c: Omit<Contract, "id" | "source" | "external_ref" | "created_at">) => {
      const { error } = await supabase.from("contracts").insert({ ...c, user_id: user!.id, source: "manual" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contrato criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...c }: { id: string } & Partial<Contract>) => {
      const { error } = await supabase.from("contracts").update(c).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contrato atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contrato removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return { contracts: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
