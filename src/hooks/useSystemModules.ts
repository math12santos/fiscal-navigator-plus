import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemModule {
  id: string;
  module_key: string;
  label: string;
  enabled: boolean;
  maintenance_message: string | null;
  updated_at: string;
  updated_by: string | null;
}

export function useSystemModules() {
  return useQuery({
    queryKey: ["system_modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_modules")
        .select("*")
        .order("label");
      if (error) throw error;
      return (data ?? []) as SystemModule[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useToggleSystemModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      enabled,
      maintenance_message,
    }: {
      id: string;
      enabled: boolean;
      maintenance_message?: string;
    }) => {
      const updates: Record<string, unknown> = { enabled };
      if (maintenance_message !== undefined) {
        updates.maintenance_message = maintenance_message;
      }
      const { error } = await supabase
        .from("system_modules")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["system_modules"] });
      const prev = qc.getQueryData<SystemModule[]>(["system_modules"]);
      qc.setQueryData<SystemModule[]>(["system_modules"], (old) =>
        old?.map((m) => (m.id === id ? { ...m, enabled } : m))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["system_modules"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["system_modules"] }),
  });
}

/** Check if a specific module is enabled system-wide */
export function useIsModuleEnabled(moduleKey: string) {
  const { data: modules = [], isLoading } = useSystemModules();
  const mod = modules.find((m) => m.module_key === moduleKey);
  return {
    isEnabled: mod ? mod.enabled : true, // default to enabled if not found
    isLoading,
    maintenanceMessage: mod?.maintenance_message || "Este módulo está temporariamente indisponível para manutenção.",
  };
}
