// Histórico mensal de maturidade por organização + setor.

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SectorKey, SectorMaturityResult } from "@/lib/sectorMaturity/types";

export interface MaturityHistoryRow {
  id: string;
  organization_id: string;
  sector: string;
  period_month: string; // YYYY-MM-01
  score: number;
  completeness_score: number;
  freshness_score: number;
  routines_score: number;
  maturity_label: string | null;
  snapshot_at: string;
}

/**
 * Lê o histórico de uma organização específica.
 * Se não receber organizationId, usa a organização atual do contexto.
 */
export function useMaturityHistory(
  sector: SectorKey,
  organizationId?: string,
  monthsBack = 12
) {
  const { currentOrg } = useOrganization();
  const orgId = organizationId ?? currentOrg?.id;

  return useQuery({
    queryKey: ["maturity-history", orgId, sector, monthsBack],
    queryFn: async () => {
      if (!orgId) return [] as MaturityHistoryRow[];
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - monthsBack);
      cutoff.setDate(1);

      const { data, error } = await supabase
        .from("sector_onboarding_history" as any)
        .select("*")
        .eq("organization_id", orgId)
        .eq("sector", sector)
        .gte("period_month", cutoff.toISOString().slice(0, 10))
        .order("period_month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MaturityHistoryRow[];
    },
    enabled: !!orgId,
  });
}

/**
 * Backfill defensivo: garante que o snapshot do mês corrente exista
 * assim que o usuário acessa o módulo (não espera o cron mensal).
 */
export function useMaturityMonthlyBackfill(
  sector: SectorKey,
  result: SectorMaturityResult | null
) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const lastSavedRef = useRef<string>("");

  const periodMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  useEffect(() => {
    if (!result || !orgId || !user?.id) return;
    const sig = `${orgId}|${sector}|${periodMonth}|${result.score}|${result.completeness}|${result.freshness}|${result.routines}`;
    if (sig === lastSavedRef.current) return;

    const t = setTimeout(async () => {
      const { error } = await supabase
        .from("sector_onboarding_history" as any)
        .upsert(
          {
            organization_id: orgId,
            sector,
            period_month: periodMonth,
            score: result.score,
            completeness_score: result.completeness,
            freshness_score: result.freshness,
            routines_score: result.routines,
            maturity_label: result.label,
            checklist: result.checklist as any,
            snapshot_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,sector,period_month" }
        );
      if (!error) {
        lastSavedRef.current = sig;
      }
    }, 2500);

    return () => clearTimeout(t);
  }, [result, orgId, user?.id, sector, periodMonth]);
}
