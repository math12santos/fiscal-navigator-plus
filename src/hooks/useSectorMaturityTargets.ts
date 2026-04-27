// Hook para ler/gravar metas de maturidade por organização e setor.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  DEFAULT_TARGETS,
  SectorMaturityTargets,
  normalizeTargets,
} from "@/lib/sectorMaturity/targets";
import { SectorKey } from "@/lib/sectorMaturity/types";
import { toast } from "sonner";

export function useSectorMaturityTargets(sector: SectorKey, orgIdOverride?: string) {
  const { currentOrg } = useOrganization();
  const orgId = orgIdOverride ?? currentOrg?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sector-maturity-targets", orgId, sector],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("sector_maturity_targets" as any)
        .select("*")
        .eq("organization_id", orgId)
        .eq("sector", sector)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
    enabled: !!orgId,
  });

  const targets: SectorMaturityTargets = normalizeTargets(query.data);
  const hasCustomTargets = !!query.data;

  const upsert = useMutation({
    mutationFn: async (next: Partial<SectorMaturityTargets>) => {
      if (!orgId) throw new Error("Organização não selecionada");
      const merged = normalizeTargets({ ...targets, ...next });
      const payload = {
        organization_id: orgId,
        sector,
        ...merged,
      };
      const { error } = await supabase
        .from("sector_maturity_targets" as any)
        .upsert(payload, { onConflict: "organization_id,sector" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sector-maturity-targets", orgId, sector] });
      qc.invalidateQueries({ queryKey: ["sector-onboarding"] });
      toast.success("Metas de maturidade atualizadas");
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar metas", { description: e?.message });
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organização não selecionada");
      const { error } = await supabase
        .from("sector_maturity_targets" as any)
        .delete()
        .eq("organization_id", orgId)
        .eq("sector", sector);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sector-maturity-targets", orgId, sector] });
      qc.invalidateQueries({ queryKey: ["sector-onboarding"] });
      toast.success("Metas restauradas para os padrões");
    },
    onError: (e: any) => {
      toast.error("Erro ao restaurar padrões", { description: e?.message });
    },
  });

  return {
    targets,
    defaults: DEFAULT_TARGETS,
    hasCustomTargets,
    isLoading: query.isLoading,
    upsert: upsert.mutate,
    upsertAsync: upsert.mutateAsync,
    isSaving: upsert.isPending,
    reset: reset.mutate,
    isResetting: reset.isPending,
  };
}
