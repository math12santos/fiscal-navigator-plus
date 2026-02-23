import { useMemo } from "react";
import { format, addMonths, startOfMonth, isAfter, isBefore } from "date-fns";
import { useEmployees } from "@/hooks/useDP";
import { useDPConfig } from "@/hooks/useDP";
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

/**
 * Generate payroll projections as virtual CashFlowEntry items.
 * Mirrors the contract-projection pattern in useCashFlow.
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

    const entries: Omit<CashFlowEntry, "user_id" | "organization_id">[] = [];
    const activeEmployees = employees.filter((e) => e.status === "ativo");

    let cursor = startOfMonth(rangeFrom);
    while (!isAfter(cursor, rangeTo)) {
      const monthKey = format(cursor, "yyyy-MM");
      const monthDate = format(cursor, "yyyy-MM-dd");

      // Aggregate all employee costs for this month
      let totalFolha = 0;
      let totalEncargos = 0;
      let totalVT = 0;
      let totalBeneficios = 0;
      let totalProvisoes = 0;

      for (const emp of activeEmployees) {
        // Check if employee is active in this month
        const admDate = new Date(emp.admission_date);
        if (isAfter(startOfMonth(admDate), cursor)) continue; // not yet hired
        if (emp.dismissal_date) {
          const disDate = new Date(emp.dismissal_date);
          if (isBefore(disDate, cursor)) continue; // already dismissed
        }

        const salary = Number(emp.salary_base);

        // Base salary
        totalFolha += salary;

        // Employer charges
        totalEncargos += salary * (inssPatronalPct + ratPct + fgtsPct + terceirosPct);

        // VT (net cost = VT_diario * 22 - 6% of salary)
        if (emp.vt_ativo && emp.vt_diario > 0) {
          const vtBruto = Number(emp.vt_diario) * 22;
          const vtDesconto = salary * vtDescontoPct;
          totalVT += Math.max(0, vtBruto - vtDesconto);
        }

        // Benefits
        totalBeneficios += benefitsByEmployee.get(emp.id) ?? 0;

        // Provisions (13th + vacation)
        totalProvisoes += salary * (provisao13Pct + provisaoFeriasPct);
      }

      const totalMensal = totalFolha + totalEncargos + totalVT + totalBeneficios + totalProvisoes;

      if (totalMensal > 0) {
        entries.push({
          id: `proj-dp-folha-${monthKey}`,
          contract_id: null,
          contract_installment_id: null,
          tipo: "saida",
          categoria: "Pessoal",
          descricao: `Folha de Pagamento — ${format(cursor, "MM/yyyy")}`,
          valor_previsto: totalFolha + totalEncargos,
          valor_realizado: null,
          data_prevista: monthDate,
          data_realizada: null,
          status: "previsto",
          account_id: null,
          cost_center_id: null,
          entity_id: null,
          notes: `Salários: ${totalFolha.toFixed(0)} | Encargos: ${totalEncargos.toFixed(0)}`,
          source: "dp",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (totalVT > 0) {
          entries.push({
            id: `proj-dp-vt-${monthKey}`,
            contract_id: null,
            contract_installment_id: null,
            tipo: "saida",
            categoria: "Pessoal",
            descricao: `Vale Transporte — ${format(cursor, "MM/yyyy")}`,
            valor_previsto: totalVT,
            valor_realizado: null,
            data_prevista: monthDate,
            data_realizada: null,
            status: "previsto",
            account_id: null,
            cost_center_id: null,
            entity_id: null,
            notes: null,
            source: "dp",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (totalBeneficios > 0) {
          entries.push({
            id: `proj-dp-beneficios-${monthKey}`,
            contract_id: null,
            contract_installment_id: null,
            tipo: "saida",
            categoria: "Pessoal",
            descricao: `Benefícios — ${format(cursor, "MM/yyyy")}`,
            valor_previsto: totalBeneficios,
            valor_realizado: null,
            data_prevista: monthDate,
            data_realizada: null,
            status: "previsto",
            account_id: null,
            cost_center_id: null,
            entity_id: null,
            notes: null,
            source: "dp",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (totalProvisoes > 0) {
          entries.push({
            id: `proj-dp-provisoes-${monthKey}`,
            contract_id: null,
            contract_installment_id: null,
            tipo: "saida",
            categoria: "Pessoal",
            descricao: `Provisões (13º + Férias) — ${format(cursor, "MM/yyyy")}`,
            valor_previsto: totalProvisoes,
            valor_realizado: null,
            data_prevista: monthDate,
            data_realizada: null,
            status: "previsto",
            account_id: null,
            cost_center_id: null,
            entity_id: null,
            notes: null,
            source: "dp",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      cursor = addMonths(cursor, 1);
    }

    return entries;
  }, [employees, config, employeeBenefits, rangeFrom, rangeTo]);

  // Monthly totals for summary
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
