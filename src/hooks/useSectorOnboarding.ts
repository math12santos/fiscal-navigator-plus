// Hook que calcula o termômetro de maturidade do setor no client,
// e persiste o resultado em `sector_onboarding` (cache para o Backoffice).
// Suporta múltiplos setores (DP, Financeiro, ...).

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEmployees, usePayrollRuns, useDPConfig } from "@/hooks/useDP";
import { useDPBenefits, useEmployeeBenefits } from "@/hooks/useDPBenefits";
import { evaluateDP } from "@/lib/sectorMaturity/dp";
import { evaluateFinanceiro } from "@/lib/sectorMaturity/financeiro";
import { evaluateJuridico } from "@/lib/sectorMaturity/juridico";
import { evaluateTI } from "@/lib/sectorMaturity/ti";
import { evaluateCompras } from "@/lib/sectorMaturity/compras";
import { SectorKey, SectorMaturityResult } from "@/lib/sectorMaturity/types";
import { useSectorMaturityTargets } from "@/hooks/useSectorMaturityTargets";

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

  const today = useMemo(() => new Date(), []);
  const competencia = format(today, "yyyy-MM");
  const isDP = sector === "dp";
  const isFin = sector === "financeiro";
  const isJur = sector === "juridico";
  const isTi = sector === "ti";
  const isCompras = sector === "compras";

  // Metas configuráveis (com fallback aos defaults quando não houver registro)
  const { targets } = useSectorMaturityTargets(sector);

  // ============== Datasets DP (carregados só quando sector === "dp") ==============
  const { data: employees = [], isLoading: loadEmp } = useEmployees();
  const { data: payrollRuns = [], isLoading: loadPay } = usePayrollRuns();
  const { data: dpConfig, isLoading: loadCfg } = useDPConfig();
  const { data: benefits = [], isLoading: loadBen } = useDPBenefits();
  const { data: employeeBenefits = [], isLoading: loadEB } = useEmployeeBenefits();

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
    enabled: !!orgId && isDP,
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
    enabled: !!orgId && isDP,
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
    enabled: !!orgId && isDP,
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
    enabled: !!orgId && isDP,
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
    enabled: !!orgId && isDP,
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
    enabled: !!orgId && isDP,
  });

  const dpRoutinesQ = useQuery({
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
    enabled: !!orgId && isDP,
  });

  // ============== Datasets Financeiro ==============
  const finChartQ = useQuery({
    queryKey: ["fin-chart-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, type, nature, accounting_class, is_synthetic, active")
        .eq("organization_id", orgId!)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finCostCentersQ = useQuery({
    queryKey: ["fin-cc-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, name, active")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finBankQ = useQuery({
    queryKey: ["fin-bank-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, nome, active, saldo_atualizado_em, saldo_atual")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finEntitiesQ = useQuery({
    queryKey: ["fin-entities-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("id, type")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finGroupingMacrosQ = useQuery({
    queryKey: ["fin-grouping-macros-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grouping_macrogroups" as any)
        .select("id")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finGroupingGroupsQ = useQuery({
    queryKey: ["fin-grouping-groups-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grouping_groups" as any)
        .select("id")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finGroupingRulesQ = useQuery({
    queryKey: ["fin-grouping-rules-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grouping_rules" as any)
        .select("id, enabled")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finContractsQ = useQuery({
    queryKey: ["fin-contracts-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, status, tipo_recorrencia")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  // Cashflow do mês corrente
  const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), "yyyy-MM-dd");
  const finCashflowMonthQ = useQuery({
    queryKey: ["fin-cashflow-month-maturity", orgId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashflow_entries")
        .select("id, status, account_id, cost_center_id, forma_pagamento, data_prevista, data_realizada")
        .eq("organization_id", orgId!)
        .gte("data_prevista", monthStart)
        .lte("data_prevista", monthEnd);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  // Cashflow do mês anterior (para conciliação)
  const prevMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 1, 1), [today]);
  const prevMonthKey = format(prevMonth, "yyyy-MM");
  const prevStart = format(prevMonth, "yyyy-MM-dd");
  const prevEnd = format(new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0), "yyyy-MM-dd");
  const finCashflowPrevQ = useQuery({
    queryKey: ["fin-cashflow-prev-maturity", orgId, prevMonthKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashflow_entries")
        .select("id, status, data_realizada")
        .eq("organization_id", orgId!)
        .gte("data_prevista", prevStart)
        .lte("data_prevista", prevEnd);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  // Lançamentos vencidos > 30 dias e ainda previstos
  const cutoff30 = format(new Date(today.getTime() - 30 * 24 * 3600 * 1000), "yyyy-MM-dd");
  const finOverdueQ = useQuery({
    queryKey: ["fin-overdue-maturity", orgId, cutoff30],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashflow_entries")
        .select("id, status, data_vencimento")
        .eq("organization_id", orgId!)
        .eq("status", "previsto")
        .lt("data_vencimento", cutoff30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  const finPeriodQ = useQuery({
    queryKey: ["fin-period-maturity", orgId, prevMonthKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_periods" as any)
        .select("id, status, year_month")
        .eq("organization_id", orgId!)
        .eq("year_month", prevMonthKey)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!orgId && isFin,
  });

  // Requests financeiras do mês (rotinas)
  const finRequestsQ = useQuery({
    queryKey: ["fin-requests-maturity", orgId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, status, due_date, type")
        .eq("organization_id", orgId!)
        .in("type", ["expense_request", "financeiro", "rotina_financeiro"])
        .eq("competencia", competencia);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isFin,
  });

  // ============== Datasets Jurídico ==============
  const jurConfigQ = useQuery({
    queryKey: ["jur-config-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_config" as any).select("*").eq("organization_id", orgId!).maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
    enabled: !!orgId && isJur,
  });
  const jurProcessesQ = useQuery({
    queryKey: ["jur-processes-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_processes" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isJur,
  });
  const jurMovementsQ = useQuery({
    queryKey: ["jur-movements-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_movements" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isJur,
  });
  const jurSettlementsQ = useQuery({
    queryKey: ["jur-settlements-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_settlements" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isJur,
  });
  const jurInstallmentsQ = useQuery({
    queryKey: ["jur-installments-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_settlement_installments" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isJur,
  });
  const jurDocumentsQ = useQuery({
    queryKey: ["jur-documents-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_documents" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isJur,
  });
  const jurExpensesQ = useQuery({
    queryKey: ["jur-expenses-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_expenses" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isJur,
  });
  const jurCashflowCountQ = useQuery({
    queryKey: ["jur-cashflow-count-maturity", orgId, competencia],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cashflow_entries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId!)
        .eq("source", "juridico")
        .gte("data_prevista", monthStart)
        .lte("data_prevista", monthEnd);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!orgId && isJur,
  });
  const jurRequestsQ = useQuery({
    queryKey: ["jur-requests-maturity", orgId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, status, due_date")
        .eq("organization_id", orgId!)
        .eq("type", "rotina_juridico")
        .eq("competencia", competencia);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isJur,
  });

  // ============== Datasets TI ==============
  const tiConfigQ = useQuery({
    queryKey: ["ti-config-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_config" as any).select("*").eq("organization_id", orgId!).maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
    enabled: !!orgId && isTi,
  });
  const tiEquipmentQ = useQuery({
    queryKey: ["ti-equipment-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_equipment" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiSystemsQ = useQuery({
    queryKey: ["ti-systems-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_systems" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiTelecomQ = useQuery({
    queryKey: ["ti-telecom-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_telecom" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiTicketsQ = useQuery({
    queryKey: ["ti-tickets-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_tickets" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiIncidentsQ = useQuery({
    queryKey: ["ti-incidents-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_incidents" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiDeprParamsQ = useQuery({
    queryKey: ["ti-depr-params-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_depreciation_params" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiDeprScheduleQ = useQuery({
    queryKey: ["ti-depr-schedule-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_depreciation_schedule" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiMovementsQ = useQuery({
    queryKey: ["ti-movements-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_equipment_movements" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiSlaQ = useQuery({
    queryKey: ["ti-sla-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_sla_policies" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiAttachmentsQ = useQuery({
    queryKey: ["ti-attachments-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_equipment_attachments" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isTi,
  });
  const tiRequestsQ = useQuery({
    queryKey: ["ti-requests-maturity", orgId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, status, due_date")
        .eq("organization_id", orgId!)
        .eq("type", "rotina_ti")
        .eq("competencia", competencia);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isTi,
  });

  // ============== Datasets Compras ==============
  const compSettingsQ = useQuery({
    queryKey: ["comp-settings-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_settings" as any).select("*").eq("organization_id", orgId!).maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
    enabled: !!orgId && isCompras,
  });
  const compRulesQ = useQuery({
    queryKey: ["comp-rules-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_rules" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compSuppliersQ = useQuery({
    queryKey: ["comp-suppliers-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compRequestsQ = useQuery({
    queryKey: ["comp-requests-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests" as any)
        .select("*, items:purchase_request_items(id)")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compApprovalsQ = useQuery({
    queryKey: ["comp-approvals-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_approvals" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compOrdersQ = useQuery({
    queryKey: ["comp-orders-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compQuotationsQ = useQuery({
    queryKey: ["comp-quotations-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_quotations" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compReceiptsQ = useQuery({
    queryKey: ["comp-receipts-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_receipts" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compDivergencesQ = useQuery({
    queryKey: ["comp-divergences-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_divergences" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compRecurrencesQ = useQuery({
    queryKey: ["comp-recurrences-maturity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_recurrences" as any).select("*").eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId && isCompras,
  });
  const compRequestsRoutinesQ = useQuery({
    queryKey: ["comp-routines-maturity", orgId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, status, due_date")
        .eq("organization_id", orgId!)
        .eq("type", "rotina_compras")
        .eq("competencia", competencia);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isCompras,
  });

  // ============== Cálculo ==============
  const result: SectorMaturityResult | null = useMemo(() => {
    if (!orgId) return null;

    if (isDP) {
      const activeEmployees = employees.filter((e: any) => e.status === "ativo");
      const reqs = dpRoutinesQ.data ?? [];
      const generated = reqs.length;
      const completed = reqs.filter((r: any) => r.status === "concluida" || r.status === "concluído").length;
      const overdue = reqs.filter(
        (r: any) =>
          r.due_date &&
          new Date(r.due_date) < today &&
          !(r.status === "concluida" || r.status === "concluído" || r.status === "cancelada")
      ).length;

      return evaluateDP({
        targets,
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
        positionRoutines: positionRoutinesQ.data ?? [],
        routinesGenerated: generated,
        routinesCompleted: completed,
        routinesOverdue: overdue,
        refDate: today,
      });
    }

    if (isFin) {
      const reqs = finRequestsQ.data ?? [];
      const generated = reqs.length;
      const completed = reqs.filter(
        (r: any) => r.status === "concluida" || r.status === "concluído" || r.status === "aprovada" || r.status === "paga"
      ).length;
      const overdue = reqs.filter(
        (r: any) =>
          r.due_date &&
          new Date(r.due_date) < today &&
          !(r.status === "concluida" || r.status === "concluído" || r.status === "cancelada" || r.status === "paga")
      ).length;

      return evaluateFinanceiro({
        targets,
        chartAccounts: finChartQ.data ?? [],
        costCenters: finCostCentersQ.data ?? [],
        bankAccounts: finBankQ.data ?? [],
        entities: finEntitiesQ.data ?? [],
        groupingMacros: finGroupingMacrosQ.data ?? [],
        groupingGroups: finGroupingGroupsQ.data ?? [],
        groupingRules: finGroupingRulesQ.data ?? [],
        contractsActive: finContractsQ.data ?? [],
        cashflowMonth: finCashflowMonthQ.data ?? [],
        cashflowPrevMonth: finCashflowPrevQ.data ?? [],
        overdueEntries: finOverdueQ.data ?? [],
        prevPeriod: finPeriodQ.data ?? null,
        routinesGenerated: generated,
        routinesCompleted: completed,
        routinesOverdue: overdue,
        refDate: today,
      });
    }

    return null;
  }, [
    orgId, isDP, isFin, today,
    // DP deps
    dpConfig, businessDaysQ.data, positionsQ.data, employees, benefits,
    employeeBenefits, documentsQ.data, payrollRuns, compensationsQ.data,
    vacationsQ.data, positionRoutinesQ.data, dpRoutinesQ.data,
    // Financeiro deps
    finChartQ.data, finCostCentersQ.data, finBankQ.data, finEntitiesQ.data,
    finGroupingMacrosQ.data, finGroupingGroupsQ.data, finGroupingRulesQ.data,
    finContractsQ.data, finCashflowMonthQ.data, finCashflowPrevQ.data,
    finOverdueQ.data, finPeriodQ.data, finRequestsQ.data,
    // Targets
    targets,
  ]);

  const isLoading = isDP
    ? (loadEmp || loadPay || loadCfg || loadBen || loadEB ||
       positionsQ.isLoading || businessDaysQ.isLoading || documentsQ.isLoading ||
       compensationsQ.isLoading || vacationsQ.isLoading || positionRoutinesQ.isLoading || dpRoutinesQ.isLoading)
    : isFin
    ? (finChartQ.isLoading || finCostCentersQ.isLoading || finBankQ.isLoading ||
       finEntitiesQ.isLoading || finGroupingMacrosQ.isLoading || finGroupingGroupsQ.isLoading ||
       finGroupingRulesQ.isLoading || finContractsQ.isLoading || finCashflowMonthQ.isLoading ||
       finCashflowPrevQ.isLoading || finOverdueQ.isLoading || finPeriodQ.isLoading || finRequestsQ.isLoading)
    : false;

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
    const sig = `${sector}|${result.score}|${result.completeness}|${result.freshness}|${result.routines}`;
    if (sig === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = sig;
      persist.mutate(result);
    }, 1500);
    return () => clearTimeout(t);
  }, [autoPersist, result, isLoading, orgId, user?.id, sector, persist]);

  return {
    result,
    isLoading,
    refresh: () => {
      // DP
      qc.invalidateQueries({ queryKey: ["dp-positions-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-business-days-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-documents-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-compensations-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-vacations-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-position-routines-maturity"] });
      qc.invalidateQueries({ queryKey: ["dp-routines-maturity"] });
      // Financeiro
      qc.invalidateQueries({ queryKey: ["fin-chart-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-cc-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-bank-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-entities-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-grouping-macros-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-grouping-groups-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-grouping-rules-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-contracts-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-cashflow-month-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-cashflow-prev-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-overdue-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-period-maturity"] });
      qc.invalidateQueries({ queryKey: ["fin-requests-maturity"] });
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
