import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "./useAuditLog";

export interface ChartAccount {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: string;
  nature: string;
  accounting_class: string;
  level: number;
  parent_id: string | null;
  description: string | null;
  tags: string[] | null;
  is_synthetic: boolean;
  is_system_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type CreateInput = Omit<ChartAccount, "id" | "user_id" | "created_at" | "updated_at">;
type UpdateInput = { id: string } & Partial<CreateInput>;

export function useChartOfAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { log } = useAuditLog();

  const query = useQuery({
    queryKey: ["chart_of_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .select("*")
        .order("code", { ascending: true });
      if (error) throw error;
      return data as unknown as ChartAccount[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: CreateInput) => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChartAccount;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      log({ entity_type: "chart_of_accounts", entity_id: data.id, action: "INSERT", new_data: data as any });
      toast({ title: "Conta criada com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar conta", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateInput) => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChartAccount;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      log({ entity_type: "chart_of_accounts", entity_id: data.id, action: "UPDATE", new_data: data as any });
      toast({ title: "Conta atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .update({ active })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChartAccount;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      log({
        entity_type: "chart_of_accounts",
        entity_id: data.id,
        action: data.active ? "ACTIVATE" : "DEACTIVATE",
        new_data: data as any,
      });
      toast({ title: data.active ? "Conta ativada" : "Conta desativada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts" as any).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      log({ entity_type: "chart_of_accounts", entity_id: id, action: "DELETE" });
      toast({ title: "Conta removida" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    toggleActive,
    remove,
  };
}
