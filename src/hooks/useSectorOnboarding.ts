// Hook que calcula o termômetro de maturidade do setor DP no client,
// e persiste o resultado em `sector_onboarding` (cache para o Backoffice).

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEmployees, usePayrollRuns, useDPConfig } from "@/hooks/useDP";
import { useDPBenefits, useEmployeeBenefits } from "@/hooks/useDPBenefits";
import { evaluateDP } from "@/lib/sectorMaturity/dp";
import { SectorKey, SectorMaturityResult } from "@/lib/sectorMaturity/types";

interface UseSectorOnboardingOptions {
  autoPersist?: boolean; // default true
}

export function useSectorOnboarding(
  sector: SectorKey,
  opts: UseSectorOnboardingOptions = {}
) {
  const autoPersist = opts.autoPersist !== false;
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();

  // ============== Datasets compartilhados (DP) ==============
  const { data: employees = [], isLoading: loadEmp } = useEmployees();
  const { data: payrollRuns = [], isLoading: loadPay } = usePayrollRuns();
  const { data: dpConfig, isLoading: loadCfg } = useDPConfig();
  const { data: benefits = [], isLoading: loadBen } = useDPBenefits();
  const { data: employeeBenefits = [], isLoading: loadEB } = useEmployeeBenefits();

  // ============== Datasets específicos para a maturidade ==============
  const positionsQ = useQuery({
    queryKey: ["dp-positions-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name, salary_min, salary_max, responsibilities, active")
        .eq("organization_id", orgId!)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && sector === "dp",
  });

  const businessDaysQ = useQuery({
    queryKey: ["dp-business-days-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dp_business_days")
        .select("id, reference_month, business_days")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && sector === "dp",
  });

  const documentsQ = useQuery({
    queryKey: ["dp-documents-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("id, employee_id, doc_type, expires_at")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && sector === "dp",
  });

  const compensationsQ = useQuery({
    queryKey: ["dp-compensations-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_compensations")
        .select("id, employee_id, type, value, created_at, active")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && sector === "dp",
  });

  const vacationsQ = useQuery({
    queryKey: ["dp-vacations-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("id, employee_id, status, data_inicio, periodo_aquisitivo_fim")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && sector === "dp",
  });

  const positionRoutinesQ = useQuery({
    queryKey: ["dp-position-routines-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("position_routines")
        .select("id, position_id, active")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && sector === "dp",
  });

  // Rotinas DP do mês corrente
  const today = useMemo(() => new Date(), []);
  const competencia = format(today, "yyyy-MM");
  const routinesQ = useQuery({
    queryKey: ["dp-routines-maturity", orgId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, status, due_date")
        .eq("organization_id", orgId!)
        .eq("type", "rotina_dp")
        .eq("competencia", competencia);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && sector === "dp",
  });

  // ============== Cálculo ==============
  const result: SectorMaturityResult | null = useMemo(() => {
    if (!orgId || sector !== "dp") return null;

    const activeEmployees = employees.filter((e: any) => e.status === "ativo");
    const reqs = routinesQ.data ?? [];
    const generated = reqs.length;
    const completed = reqs.filter((r: any) => r.status === "concluida" || r.status === "concluído").length;
    const overdue = reqs.filter(
      (r: any) =>
        r.due_date &&
        new Date(r.due_date) < today &&
        !(r.status === "concluida" || r.status === "concluído" || r.status === "cancelada")
    ).length;

    return evaluateDP({
      dpConfig: dpConfig ?? null,
      businessDays: businessDaysQ.data ?? [],
      positions: positionsQ.data ?? [],
      employees: activeEmployees,
      benefits: benefits ?? [],
      employeeBenefits: (employeeBenefits ?? []).filter((b: any) => b.active),
      documents: documentsQ.data ?? [],
      payrollRuns: payrollRuns ?? [],
      compensations: compensationsQ.data ?? [],
      vacations: vacationsQ.data ?? [],
      routinesGenerated: generated,
      routinesCompleted: completed,
      routinesOverdue: overdue,
      refDate: today,
    });
  }, [
    orgId, sector, dpConfig, businessDaysQ.data, positionsQ.data,
    employees, benefits, employeeBenefits, documentsQ.data,
    payrollRuns, compensationsQ.data, vacationsQ.data, routinesQ.data, today,
  ]);

  const isLoading =
    loadEmp || loadPay || loadCfg || loadBen || loadEB ||
    positionsQ.isLoading || businessDaysQ.isLoading ||
    documentsQ.isLoading || compensationsQ.isLoading ||
    vacationsQ.isLoading || routinesQ.isLoading;

  // ============== Cache na tabela sector_onboarding ==============
  const persist = useMutation({
    mutationFn: async (r: SectorMaturityResult) => {
      if (!orgId || !user?.id) return;
      const payload = {
        organization_id: orgId,
        sector,
        score: r.score,
        completeness_score: r.completeness,
        freshness_score: r.freshness,
        routines_score: r.routines,
        maturity_label: r.label,
        checklist: r.checklist as any,
        last_calculated_at: new Date().toISOString(),
        user_id: user.id,
      };
      const { error } = await supabase
        .from("sector_onboarding" as any)
        .upsert(payload, { onConflict: "organization_id,sector" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sector-onboarding"] });
    },
  });

  // Auto-persist com debounce — só após o cálculo estabilizar
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!autoPersist || !result || isLoading || !orgId || !user?.id) return;
    const sig = `${result.score}|${result.completeness}|${result.freshness}|${result.routines}`;
    if (sig === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = sig;
      persist.mutate(result);
    }, 1500);
    return () => clearTimeout(t);
  }, [autoPersist, result, isLoading, orgId, user?.id, persist]);

  return {
    result,
    isLoading,
    refresh: () => {
      qc.invalidateQueries({ queryKey: ["dp-positions-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-business-days-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-documents-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-compensations-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-vacations-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-routines-maturity"] });
    },
    persist: (r: SectorMaturityResult) => persist.mutateAsync(r),
  };
}

// Lista (Backoffice): lê o cache `sector_onboarding` para todas as orgs visíveis.
export function useSectorOnboardingList(sector?: SectorKey) {
  return useQuery({
    queryKey: ["sector-onboarding-list", sector ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("sector_onboarding" as any)
        .select("*")
        .order("score", { ascending: true });
      if (sector) q = q.eq("sector", sector);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
