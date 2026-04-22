import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface KpiPeriodPreset {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  range_from: string; // ISO date (yyyy-MM-dd)
  range_to: string;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para gerir presets de período (from/to) salvos pelo usuário,
 * escopados por (user_id, organization_id) com RLS.
 *
 * Princípio do produto: presets são apenas atalhos de visualização —
 * não alteram dados. Uma URL com ?from=&to= aplicada via preset
 * permanece reproduzível e compartilhável.
 */
export function useKpiPeriodPresets() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  const enabled = !!user?.id && !!currentOrg?.id;
  const queryKey = ["kpi-period-presets", currentOrg?.id, user?.id];

  const { data: presets = [], isLoading } = useQuery<KpiPeriodPreset[]>({
    queryKey,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_period_presets")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .eq("user_id", user!.id)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KpiPeriodPreset[];
    },
  });

  const savePreset = useMutation({
    mutationFn: async ({ name, from, to }: { name: string; from: string; to: string }) => {
      if (!user?.id || !currentOrg?.id) throw new Error("Sessão inválida");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Informe um nome para o preset");
      if (trimmed.length > 60) throw new Error("Nome deve ter no máximo 60 caracteres");

      // Upsert por (user_id, organization_id, name) para manter o "mesmo nome substitui" do plano
      const { data, error } = await supabase
        .from("kpi_period_presets")
        .upsert(
          {
            user_id: user.id,
            organization_id: currentOrg.id,
            name: trimmed,
            range_from: from,
            range_to: to,
          },
          { onConflict: "user_id,organization_id,name" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as KpiPeriodPreset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Preset salvo");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível salvar o preset");
    },
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kpi_period_presets").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Preset excluído");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível excluir o preset");
    },
  });

  return {
    presets,
    isLoading,
    savePreset: (name: string, from: string, to: string) =>
      savePreset.mutateAsync({ name, from, to }),
    deletePreset: (id: string) => deletePreset.mutateAsync(id),
    isSaving: savePreset.isPending,
    isDeleting: deletePreset.isPending,
  };
}
