import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { KPI_REGISTRY } from "@/components/financeiro/dashboard/kpiRegistry";

interface KpiPrefRow {
  kpi_id: string;
  enabled: boolean;
}

/**
 * Lê e grava preferências de visualização dos KPIs do Dashboard Financeiro,
 * por usuário + organização. Padrão: tudo ligado, exceto KPIs com
 * `defaultEnabled: false` no registry.
 */
export function useKpiPreferences() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["dashboard_kpi_preferences", user?.id, orgId],
    queryFn: async () => {
      if (!user || !orgId) return [] as KpiPrefRow[];
      const { data, error } = await supabase
        .from("dashboard_kpi_preferences" as any)
        .select("kpi_id, enabled")
        .eq("user_id", user.id)
        .eq("organization_id", orgId);
      if (error) throw error;
      return (data ?? []) as unknown as KpiPrefRow[];
    },
    enabled: !!user && !!orgId,
  });

  // Map kpi_id → enabled, mesclando com defaults do registry.
  const enabledMap = useMemo(() => {
    const stored = new Map<string, boolean>();
    (query.data ?? []).forEach((r) => stored.set(r.kpi_id, r.enabled));
    const out: Record<string, boolean> = {};
    for (const k of KPI_REGISTRY) {
      out[k.id] = stored.has(k.id) ? !!stored.get(k.id) : k.defaultEnabled !== false;
    }
    return out;
  }, [query.data]);

  const setEnabled = useMutation({
    mutationFn: async ({ kpiId, enabled }: { kpiId: string; enabled: boolean }) => {
      if (!user || !orgId) throw new Error("Sem contexto de usuário/organização");
      const { error } = await supabase
        .from("dashboard_kpi_preferences" as any)
        .upsert(
          {
            user_id: user.id,
            organization_id: orgId,
            kpi_id: kpiId,
            enabled,
          } as any,
          { onConflict: "user_id,organization_id,kpi_id" } as any,
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard_kpi_preferences", user?.id, orgId] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar preferência", description: e.message, variant: "destructive" }),
  });

  const setMany = useMutation({
    mutationFn: async (changes: { kpiId: string; enabled: boolean }[]) => {
      if (!user || !orgId) throw new Error("Sem contexto de usuário/organização");
      if (changes.length === 0) return;
      const rows = changes.map((c) => ({
        user_id: user.id,
        organization_id: orgId,
        kpi_id: c.kpiId,
        enabled: c.enabled,
      }));
      const { error } = await supabase
        .from("dashboard_kpi_preferences" as any)
        .upsert(rows as any, { onConflict: "user_id,organization_id,kpi_id" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard_kpi_preferences", user?.id, orgId] });
      toast({ title: "Preferências atualizadas" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return {
    enabledMap,
    isLoading: query.isLoading,
    setEnabled,
    setMany,
  };
}
