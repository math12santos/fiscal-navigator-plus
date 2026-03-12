import { useMemo } from "react";
import { format, addMonths, startOfMonth, isAfter, isBefore } from "date-fns";
import { useEmployees, useDPConfig, calcINSSEmpregado, calcIRRF } from "@/hooks/useDP";
import { useEmployeeBenefits } from "@/hooks/useDPBenefits";
import type { CashFlowEntry } from "@/hooks/useCashFlow";

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
        const encargos = salary * (inssPatronalPct + ratPct + fgtsPct + terceirosPct);

        // Folha (salary + charges)
        entries.push({
          id: `proj-dp-folha-${emp.id}-${monthKey}`,
          contract_id: null,
          contract_installment_id: null,
          tipo: "saida",
          categoria: "Pessoal",
          descricao: `Salário — ${emp.name}`,
          valor_previsto: salary + encargos,
          valor_realizado: null,
          data_prevista: monthDate,
          data_realizada: null,
          status: "previsto",
          account_id: null,
          cost_center_id: emp.cost_center_id ?? null,
          entity_id: null,
          notes: `Base: ${salary.toFixed(0)} | Encargos: ${encargos.toFixed(0)}`,
          source: "dp",
          dp_sub_category: "folha",
          created_at: now,
          updated_at: now,
        });

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
