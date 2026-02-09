import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "./useAuditLog";

export interface CostCenter {
  id: string;
  user_id: string;
  code: string;
  name: string;
  parent_id: string | null;
  business_unit: string | null;
  responsible: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type CreateInput = Omit<CostCenter, "id" | "user_id" | "created_at" | "updated_at">;
type UpdateInput = { id: string } & Partial<CreateInput>;

export function useCostCenters() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { log } = useAuditLog();

  const query = useQuery({
    queryKey: ["cost_centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers" as any)
        .select("*")
        .order("code", { ascending: true });
      if (error) throw error;
      return data as unknown as CostCenter[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: CreateInput) => {
      const { data, error } = await supabase
        .from("cost_centers" as any)
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CostCenter;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      log({ entity_type: "cost_centers", entity_id: data.id, action: "INSERT", new_data: data as any });
      toast({ title: "Centro de custo criado" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateInput) => {
      const { data, error } = await supabase
        .from("cost_centers" as any)
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CostCenter;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      log({ entity_type: "cost_centers", entity_id: data.id, action: "UPDATE", new_data: data as any });
      toast({ title: "Centro de custo atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await supabase
        .from("cost_centers" as any)
        .update({ active })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CostCenter;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      log({
        entity_type: "cost_centers",
        entity_id: data.id,
        action: data.active ? "ACTIVATE" : "DEACTIVATE",
        new_data: data as any,
      });
      toast({ title: data.active ? "Centro ativado" : "Centro desativado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_centers" as any).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      log({ entity_type: "cost_centers", entity_id: id, action: "DELETE" });
      toast({ title: "Centro de custo removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return {
    costCenters: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    toggleActive,
    remove,
  };
}
