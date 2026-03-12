import { useMemo } from "react";
import { format, addMonths, startOfMonth, endOfMonth, isAfter, isBefore, eachDayOfInterval, getDay } from "date-fns";
import { useEmployees, useDPConfig, calcINSSEmpregado, calcIRRF } from "@/hooks/useDP";
import { useEmployeeBenefits } from "@/hooks/useDPBenefits";
import type { CashFlowEntry } from "@/hooks/useCashFlow";

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
  dp_benefits: { name: string; type: string; default_value: number } | null;
}

const SUB_CATEGORY_LABELS: Record<string, string> = {
  salario_liquido: "Salário Líquido",
  encargos_fgts: "FGTS",
  encargos_inss: "INSS / GPS",
  encargos_irrf: "IRRF",
  vt: "Vale Transporte",
  beneficios: "Benefícios",
  provisoes: "Provisões (13º + Férias)",
};

/**
 * Generate payroll projections as virtual CashFlowEntry items — one per employee per sub-category.
 */
export function usePayrollProjections(rangeFrom?: Date, rangeTo?: Date) {
  const employeesQuery = useEmployees();
  const dpConfigQuery = useDPConfig();
  const employeeBenefitsQuery = useEmployeeBenefits();

  const employees = (employeesQuery.data ?? []) as unknown as EmployeeRow[];
  const config = dpConfigQuery.data;
  const employeeBenefits = (employeeBenefitsQuery.data ?? []) as unknown as BenefitRow[];

  const projections = useMemo(() => {
    if (!rangeFrom || !rangeTo || employees.length === 0) return [];

    const inssPatronalPct = (config?.inss_patronal_pct ?? 20) / 100;
    const ratPct = (config?.rat_pct ?? 2) / 100;
    const fgtsPct = (config?.fgts_pct ?? 8) / 100;
    const terceirosPct = (config?.terceiros_pct ?? 5.8) / 100;
    const provisao13Pct = (config?.provisao_13_pct ?? 8.33) / 100;
    const provisaoFeriasPct = (config?.provisao_ferias_pct ?? 11.11) / 100;
    const vtDescontoPct = (config?.vt_desconto_pct ?? 6) / 100;

    // Index benefits by employee
    const benefitsByEmployee = new Map<string, number>();
    for (const eb of employeeBenefits) {
      if (!eb.active) continue;
      const val = eb.custom_value ?? eb.dp_benefits?.default_value ?? 0;
      benefitsByEmployee.set(
        eb.employee_id,
        (benefitsByEmployee.get(eb.employee_id) ?? 0) + Number(val)
      );
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
        const fgtsVal = salary * fgtsPct;
        const inssPatronalVal = salary * inssPatronalPct;
        const ratVal = salary * ratPct;
        const terceirosVal = salary * terceirosPct;
        const gpsTotal = inssPatronalVal + inssEmp + ratVal + terceirosVal;

        const base = { contract_id: null, contract_installment_id: null, tipo: "saida" as const, categoria: "Pessoal", valor_realizado: null, data_prevista: monthDate, data_realizada: null, status: "previsto", account_id: null, cost_center_id: emp.cost_center_id ?? null, entity_id: null, source: "dp", created_at: now, updated_at: now };

        // 1. Salário Líquido (includes VT discount deduction)
        const salNotes = `Base: ${salary.toFixed(0)} | INSS Emp: ${inssEmp.toFixed(0)} | IRRF: ${irrf.toFixed(0)}${vtDesconto > 0 ? ` | VT Desc: ${vtDesconto.toFixed(0)}` : ""} | Líquido: ${netSalary.toFixed(0)}`;
        entries.push({ ...base, id: `proj-dp-sal-${emp.id}-${monthKey}`, descricao: `Salário Líquido — ${emp.name}`, valor_previsto: Math.round(netSalary * 100) / 100, notes: salNotes, dp_sub_category: "salario_liquido" });

        // 2. FGTS
        if (fgtsVal > 0) {
          entries.push({ ...base, id: `proj-dp-fgts-${emp.id}-${monthKey}`, descricao: `FGTS — ${emp.name}`, valor_previsto: Math.round(fgtsVal * 100) / 100, notes: `${(fgtsPct * 100).toFixed(1)}% s/ ${salary.toFixed(0)}`, dp_sub_category: "encargos_fgts" });
        }

        // 3. GPS / INSS
        if (gpsTotal > 0) {
          entries.push({ ...base, id: `proj-dp-inss-${emp.id}-${monthKey}`, descricao: `INSS / GPS — ${emp.name}`, valor_previsto: Math.round(gpsTotal * 100) / 100, notes: `Patronal: ${inssPatronalVal.toFixed(0)} | Emp: ${inssEmp.toFixed(0)} | RAT: ${ratVal.toFixed(0)} | 3os: ${terceirosVal.toFixed(0)}`, dp_sub_category: "encargos_inss" });
        }

        // 4. IRRF
        if (irrf > 0) {
          entries.push({ ...base, id: `proj-dp-irrf-${emp.id}-${monthKey}`, descricao: `IRRF — ${emp.name}`, valor_previsto: Math.round(irrf * 100) / 100, notes: `Base cálculo: ${baseIRRF.toFixed(0)}`, dp_sub_category: "encargos_irrf" });
        }

        // VT
        if (emp.vt_ativo && emp.vt_diario > 0) {
          const vtBruto = Number(emp.vt_diario) * 22;
          const vtDesconto = salary * vtDescontoPct;
          const vtNet = Math.max(0, vtBruto - vtDesconto);
          if (vtNet > 0) {
            entries.push({
              id: `proj-dp-vt-${emp.id}-${monthKey}`,
              contract_id: null,
              contract_installment_id: null,
              tipo: "saida",
              categoria: "Pessoal",
              descricao: `VT — ${emp.name}`,
              valor_previsto: vtNet,
              valor_realizado: null,
              data_prevista: monthDate,
              data_realizada: null,
              status: "previsto",
              account_id: null,
              cost_center_id: emp.cost_center_id ?? null,
              entity_id: null,
              notes: null,
              source: "dp",
              dp_sub_category: "vt",
              created_at: now,
              updated_at: now,
            });
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
            dp_sub_category: "beneficios",
            created_at: now,
            updated_at: now,
          });
        }

        // Provisions (13th + vacation)
        const provisoes = salary * (provisao13Pct + provisaoFeriasPct);
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
            dp_sub_category: "provisoes",
            created_at: now,
            updated_at: now,
          });
        }
      }

      cursor = addMonths(cursor, 1);
    }

    return entries;
  }, [employees, config, employeeBenefits, rangeFrom, rangeTo]);

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
