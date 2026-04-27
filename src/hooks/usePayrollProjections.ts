import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format, addMonths, startOfMonth, endOfMonth, isAfter, isBefore, eachDayOfInterval, getDay } from "date-fns";
import { useEmployees, useDPConfig, calcINSSEmpregado, calcIRRF } from "@/hooks/useDP";
import { useEmployeeBenefits } from "@/hooks/useDPBenefits";
import type { CashFlowEntry } from "@/hooks/useCashFlow";
import { projectionKey } from "@/lib/projectionRegistry";

/** Count Mon–Fri business days in a given month */
export function getBusinessDays(monthStart: Date): number {
  const interval = { start: startOfMonth(monthStart), end: endOfMonth(monthStart) };
  return eachDayOfInterval(interval).filter((d) => {
    const day = getDay(d);
    return day >= 1 && day <= 5;
  }).length;
}

interface EmployeeRow {
  id: string;
  name: string;
  salary_base: number;
  status: string;
  admission_date: string;
  dismissal_date: string | null;
  vt_ativo: boolean;
  vt_diario: number;
  cost_center_id: string | null;
  contract_type: string;
}

interface BenefitRow {
  employee_id: string;
  active: boolean;
  custom_value: number | null;
  dp_benefits: { name: string; type: string; default_value: number; category?: string | null } | null;
}

const BENEFIT_CATEGORY_TO_SUB: Record<string, string> = {
  vale_refeicao: "beneficios_vr",
  vale_alimentacao: "beneficios_va",
  plano_saude: "beneficios_saude",
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
  salario_liquido: "Salário Líquido",
  encargos_fgts: "FGTS",
  encargos_inss: "INSS / GPS",
  encargos_irrf: "IRRF",
  vt: "Vale Transporte",
  beneficios: "Benefícios",
  beneficios_vr: "Vale Refeição",
  beneficios_va: "Vale Alimentação",
  beneficios_saude: "Plano de Saúde",
  beneficios_outros: "Outros Benefícios",
  provisao_acumulada: "Provisões Acumuladas (informativo)",
  provisoes: "Provisões (13º + Férias)",
};

/** Sub-categorias DP que NÃO impactam o caixa (são informativas / passivo). */
export const DP_NON_CASHFLOW_SUBCATEGORIES = new Set([
  "provisao_acumulada",
]);

/**
 * Generate payroll projections as virtual CashFlowEntry items — one per employee per sub-category.
 */
export function usePayrollProjections(rangeFrom?: Date, rangeTo?: Date) {
  const { currentOrg } = useOrganization();
  const employeesQuery = useEmployees();
  const dpConfigQuery = useDPConfig();
  const employeeBenefitsQuery = useEmployeeBenefits();

  // Fetch variable payroll events covering the planning range so they appear as
  // virtual cashflow entries — keeps projections aligned with reality.
  const eventsQuery = useQuery({
    queryKey: ["payroll_events_range", currentOrg?.id, rangeFrom?.toISOString().slice(0, 10), rangeTo?.toISOString().slice(0, 10)],
    queryFn: async () => {
      if (!currentOrg?.id || !rangeFrom || !rangeTo) return [];
      const monthFrom = format(startOfMonth(rangeFrom), "yyyy-MM");
      const monthTo = format(startOfMonth(rangeTo), "yyyy-MM");
      const { data, error } = await (supabase.from as any)("payroll_events")
        .select("id, employee_id, signal, value, description, reference_month, event_type")
        .eq("organization_id", currentOrg.id)
        .gte("reference_month", monthFrom)
        .lte("reference_month", monthTo);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id && !!rangeFrom && !!rangeTo,
  });

  const employees = (employeesQuery.data ?? []) as unknown as EmployeeRow[];
  const config = dpConfigQuery.data;
  const employeeBenefits = (employeeBenefitsQuery.data ?? []) as unknown as BenefitRow[];
  const events = (eventsQuery.data ?? []) as any[];

  const projections = useMemo(() => {
    if (!rangeFrom || !rangeTo || employees.length === 0) return [];

    const inssPatronalPct = (config?.inss_patronal_pct ?? 20) / 100;
    const ratPct = (config?.rat_pct ?? 2) / 100;
    const fgtsPct = (config?.fgts_pct ?? 8) / 100;
    const terceirosPct = (config?.terceiros_pct ?? 5.8) / 100;
    const provisao13Pct = (config?.provisao_13_pct ?? 8.33) / 100;
    const provisaoFeriasPct = (config?.provisao_ferias_pct ?? 11.11) / 100;
    const vtDescontoPct = (config?.vt_desconto_pct ?? 6) / 100;

    // Default chart-of-accounts mapping (CFO-readable books out of the box)
    const acctSalario = (config as any)?.default_account_salario ?? null;
    const acctEncargos = (config as any)?.default_account_encargos ?? null;
    const acctBeneficios = (config as any)?.default_account_beneficios ?? null;

    // Index benefits by employee, segregated by sub-category for accounting traceability.
    // empId -> { sub_category -> total_value }
    const benefitsByEmployee = new Map<string, Map<string, number>>();
    for (const eb of employeeBenefits) {
      if (!eb.active) continue;
      const val = Number(eb.custom_value ?? eb.dp_benefits?.default_value ?? 0);
      if (val === 0) continue;
      const cat = eb.dp_benefits?.category ?? "outros";
      const sub = BENEFIT_CATEGORY_TO_SUB[cat] ?? "beneficios_outros";
      const inner = benefitsByEmployee.get(eb.employee_id) ?? new Map<string, number>();
      inner.set(sub, (inner.get(sub) ?? 0) + val);
      benefitsByEmployee.set(eb.employee_id, inner);
    }

    const entries: (Omit<CashFlowEntry, "user_id" | "organization_id"> & { dp_sub_category?: string })[] = [];
    const activeEmployees = employees.filter((e) => e.status === "ativo");
    const now = new Date().toISOString();

    let cursor = startOfMonth(rangeFrom);
    while (!isAfter(cursor, rangeTo)) {
      const monthKey = format(cursor, "yyyy-MM");
      const monthDate = format(cursor, "yyyy-MM-dd");
      const monthLabel = format(cursor, "MM/yyyy");

      for (const emp of activeEmployees) {
        const admDate = new Date(emp.admission_date);
        if (isAfter(startOfMonth(admDate), cursor)) continue;
        if (emp.dismissal_date) {
          const disDate = new Date(emp.dismissal_date);
          if (isBefore(disDate, cursor)) continue;
        }

        const salary = Number(emp.salary_base);
        const isPJ = emp.contract_type === "PJ";
        const isEstagio = emp.contract_type === "estagio";

        // PJ: pagamento bruto único (NF de serviço), sem INSS empregado, IRRF de pessoa jurídica
        // tratado em outro fluxo, sem FGTS, sem provisões trabalhistas.
        if (isPJ) {
          const base = { contract_id: null, contract_installment_id: null, tipo: "saida" as const, categoria: "Pessoal", valor_realizado: null, data_prevista: monthDate, data_realizada: null, status: "previsto", account_id: null, cost_center_id: emp.cost_center_id ?? null, entity_id: null, source: "dp", created_at: now, updated_at: now };
          entries.push({
            ...base,
            id: `proj-dp-pj-${emp.id}-${monthKey}`,
            descricao: `Prestação de Serviço PJ — ${emp.name}`,
            valor_previsto: Math.round(salary * 100) / 100,
            notes: `Pagamento bruto contratual — sem encargos trabalhistas`,
            dp_sub_category: "salario_liquido",
            source_ref: projectionKey.payroll(emp.id, "salario_liquido", monthKey),
          } as any);
          continue;
        }

        const inssEmp = calcINSSEmpregado(salary);
        const baseIRRF = salary - inssEmp;
        const irrf = calcIRRF(baseIRRF);

        // VT discount (6% of salary, capped at VT gross cost)
        const businessDays = getBusinessDays(cursor);
        let vtDesconto = 0;
        if (emp.vt_ativo && emp.vt_diario > 0) {
          const vtBrutoCalc = Number(emp.vt_diario) * businessDays;
          vtDesconto = Math.min(salary * vtDescontoPct, vtBrutoCalc);
        }

        const netSalary = salary - inssEmp - irrf - vtDesconto;
        // Estágio: sem FGTS, sem encargos patronais, sem provisões 13/férias.
        const fgtsVal = isEstagio ? 0 : salary * fgtsPct;
        const inssPatronalVal = isEstagio ? 0 : salary * inssPatronalPct;
        const ratVal = isEstagio ? 0 : salary * ratPct;
        const terceirosVal = isEstagio ? 0 : salary * terceirosPct;
        const gpsTotal = inssPatronalVal + inssEmp + ratVal + terceirosVal;

        const base = { contract_id: null, contract_installment_id: null, tipo: "saida" as const, categoria: "Pessoal", valor_realizado: null, data_prevista: monthDate, data_realizada: null, status: "previsto", account_id: null, cost_center_id: emp.cost_center_id ?? null, entity_id: null, source: "dp", created_at: now, updated_at: now };

        // 1. Salário Líquido (includes VT discount deduction)
        const salNotes = `Base: ${salary.toFixed(0)} | INSS Emp: ${inssEmp.toFixed(0)} | IRRF: ${irrf.toFixed(0)}${vtDesconto > 0 ? ` | VT Desc: ${vtDesconto.toFixed(0)}` : ""} | Líquido: ${netSalary.toFixed(0)}`;
        entries.push({ ...base, id: `proj-dp-sal-${emp.id}-${monthKey}`, descricao: `Salário Líquido — ${emp.name}`, valor_previsto: Math.round(netSalary * 100) / 100, notes: salNotes, dp_sub_category: "salario_liquido", source_ref: projectionKey.payroll(emp.id, "salario_liquido", monthKey) } as any);

        // 2. FGTS
        if (fgtsVal > 0) {
          entries.push({ ...base, id: `proj-dp-fgts-${emp.id}-${monthKey}`, descricao: `FGTS — ${emp.name}`, valor_previsto: Math.round(fgtsVal * 100) / 100, notes: `${(fgtsPct * 100).toFixed(1)}% s/ ${salary.toFixed(0)}`, dp_sub_category: "encargos_fgts", source_ref: projectionKey.payroll(emp.id, "encargos_fgts", monthKey) } as any);
        }

        // 3. GPS / INSS
        if (gpsTotal > 0) {
          entries.push({ ...base, id: `proj-dp-inss-${emp.id}-${monthKey}`, descricao: `INSS / GPS — ${emp.name}`, valor_previsto: Math.round(gpsTotal * 100) / 100, notes: `Patronal: ${inssPatronalVal.toFixed(0)} | Emp: ${inssEmp.toFixed(0)} | RAT: ${ratVal.toFixed(0)} | 3os: ${terceirosVal.toFixed(0)}`, dp_sub_category: "encargos_inss", source_ref: projectionKey.payroll(emp.id, "encargos_inss", monthKey) } as any);
        }

        // 4. IRRF
        if (irrf > 0) {
          entries.push({ ...base, id: `proj-dp-irrf-${emp.id}-${monthKey}`, descricao: `IRRF — ${emp.name}`, valor_previsto: Math.round(irrf * 100) / 100, notes: `Base cálculo: ${baseIRRF.toFixed(0)}`, dp_sub_category: "encargos_irrf", source_ref: projectionKey.payroll(emp.id, "encargos_irrf", monthKey) } as any);
        }

        // VT (dynamic business days)
        if (emp.vt_ativo && emp.vt_diario > 0) {
          const vtBruto = Number(emp.vt_diario) * businessDays;
          const vtDescontoVal = Math.min(salary * vtDescontoPct, vtBruto);
          const vtNet = Math.max(0, vtBruto - vtDescontoVal);
          if (vtNet > 0) {
            entries.push({
              ...base,
              id: `proj-dp-vt-${emp.id}-${monthKey}`,
              descricao: `VT — ${emp.name}`,
              valor_previsto: Math.round(vtNet * 100) / 100,
              notes: `${businessDays} dias úteis × R$${Number(emp.vt_diario).toFixed(2)} = ${vtBruto.toFixed(0)} | Desc 6%: ${vtDescontoVal.toFixed(0)} | Líq: ${vtNet.toFixed(0)}`,
              dp_sub_category: "vt",
              source_ref: projectionKey.payroll(emp.id, "vt", monthKey),
            } as any);
          }
        }

        // Benefits
        const empBenefits = benefitsByEmployee.get(emp.id) ?? 0;
        if (empBenefits > 0) {
          entries.push({
            id: `proj-dp-beneficios-${emp.id}-${monthKey}`,
            contract_id: null,
            contract_installment_id: null,
            tipo: "saida",
            categoria: "Pessoal",
            descricao: `Benefícios — ${emp.name}`,
            valor_previsto: empBenefits,
            valor_realizado: null,
            data_prevista: monthDate,
            data_realizada: null,
            status: "previsto",
            account_id: null,
            cost_center_id: emp.cost_center_id ?? null,
            entity_id: null,
            notes: null,
            source: "dp",
            source_ref: projectionKey.payroll(emp.id, "beneficios", monthKey),
            dp_sub_category: "beneficios",
            created_at: now,
            updated_at: now,
          } as any);
        }

        // Provisions (13th + vacation) — somente CLT (estágio não tem 13/férias remuneradas)
        const provisoes = isEstagio ? 0 : salary * (provisao13Pct + provisaoFeriasPct);
        if (provisoes > 0) {
          entries.push({
            id: `proj-dp-provisoes-${emp.id}-${monthKey}`,
            contract_id: null,
            contract_installment_id: null,
            tipo: "saida",
            categoria: "Pessoal",
            descricao: `Provisões — ${emp.name}`,
            valor_previsto: provisoes,
            valor_realizado: null,
            data_prevista: monthDate,
            data_realizada: null,
            status: "previsto",
            account_id: null,
            cost_center_id: emp.cost_center_id ?? null,
            entity_id: null,
            notes: null,
            source: "dp",
            source_ref: projectionKey.payroll(emp.id, "provisoes", monthKey),
            dp_sub_category: "provisoes",
            created_at: now,
            updated_at: now,
          } as any);
        }
      }

      cursor = addMonths(cursor, 1);
    }

    // Variable payroll events — projected as outflow. Provento = saída adicional
    // (pagamento extra ao empregado); desconto = saída negativa (reduz custo).
    // Same source: "dp" namespace, dedup via `dp_event:<eventId>`.
    const empById = new Map(employees.map((e) => [e.id, e]));
    for (const ev of events) {
      const emp = empById.get(ev.employee_id);
      if (!emp) continue;
      const monthKey = (ev.reference_month || "").slice(0, 7);
      if (!monthKey) continue;
      const monthDate = `${monthKey}-01`;
      const sign = ev.signal === "desconto" ? -1 : 1;
      const value = Math.round(Number(ev.value || 0) * sign * 100) / 100;
      if (value === 0) continue;
      entries.push({
        id: `proj-dp-event-${ev.id}`,
        contract_id: null,
        contract_installment_id: null,
        tipo: "saida",
        categoria: "Pessoal",
        descricao: `${ev.signal === "desconto" ? "Desconto" : "Provento"} — ${emp.name}: ${ev.description || ev.event_type}`,
        valor_previsto: value,
        valor_realizado: null,
        data_prevista: monthDate,
        data_realizada: null,
        status: "previsto",
        account_id: null,
        cost_center_id: emp.cost_center_id ?? null,
        entity_id: null,
        notes: `Evento variável (${ev.event_type})`,
        source: "dp",
        source_ref: projectionKey.payrollEvent(ev.id),
        dp_sub_category: "eventos",
        created_at: now,
        updated_at: now,
      } as any);
    }

    return entries;
  }, [employees, config, employeeBenefits, events, rangeFrom, rangeTo]);

  const monthlyPayrollTotal = useMemo(() => {
    return projections.reduce((sum, p) => sum + Number(p.valor_previsto), 0);
  }, [projections]);

  const monthCount = useMemo(() => {
    if (!rangeFrom || !rangeTo) return 1;
    let count = 0;
    let c = startOfMonth(rangeFrom);
    while (!isAfter(c, rangeTo)) {
      count++;
      c = addMonths(c, 1);
    }
    return Math.max(1, count);
  }, [rangeFrom, rangeTo]);

  return {
    payrollProjections: projections as any[],
    monthlyPayrollTotal,
    avgMonthlyPayroll: monthlyPayrollTotal / monthCount,
    isLoading: employeesQuery.isLoading || dpConfigQuery.isLoading,
  };
}

export { SUB_CATEGORY_LABELS };
