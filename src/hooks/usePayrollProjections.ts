import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format, addMonths, startOfMonth, endOfMonth, isAfter, isBefore, eachDayOfInterval, getDay } from "date-fns";
import { useEmployees, useDPConfig } from "@/hooks/useDP";
import { useEmployeeBenefits } from "@/hooks/useDPBenefits";
import type { CashFlowEntry } from "@/hooks/useCashFlow";
import { projectionKey } from "@/lib/projectionRegistry";
import { calcEmployeeNet } from "@/lib/payrollCalc";
import { isEventTributavel } from "@/hooks/usePayrollEvents";
import {
  salaryPaymentDate,
  advancePaymentDate,
  inssDueDate,
  fgtsDueDate,
  irrfDueDate,
  benefitsPaymentDate,
  healthPaymentDate,
  fmtISO,
  formatCompetencyLong,
} from "@/lib/payrollSchedule";

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
  salario_adiantamento: "Adiantamento (Vale)",
  encargos_fgts: "FGTS (GRF)",
  encargos_inss: "INSS (GPS)",
  encargos_irrf: "IRRF (DARF)",
  vt: "Vale Transporte",
  beneficios: "Benefícios",
  beneficios_vr: "Vale Refeição",
  beneficios_va: "Vale Alimentação",
  beneficios_saude: "Plano de Saúde",
  beneficios_outros: "Outros Benefícios",
  provisao_acumulada: "Provisões Acumuladas (informativo)",
  provisoes: "Provisões (13º + Férias)",
  eventos: "Eventos variáveis",
};

/** Sub-categorias DP que NÃO impactam o caixa (são informativas / passivo). */
export const DP_NON_CASHFLOW_SUBCATEGORIES = new Set([
  "provisao_acumulada",
]);

/**
 * Generate payroll projections as virtual CashFlowEntry items.
 *
 * Granularidade:
 *  - Salário líquido / adiantamento / VT / VR / VA / saúde → **uma entrada por colaborador** (são pagamentos individuais, com cost center próprio).
 *  - INSS/GPS, FGTS/GRF e IRRF/DARF → **uma única guia consolidada por mês** (na vida real é um único débito no banco).
 *  - Provisões → uma por colaborador, marcadas `provisao_acumulada` (não somam no caixa).
 *
 * Datas alinhadas com o calendário real configurado em `dp_config`:
 *  - Salário (saldo) → 5º dia útil do mês seguinte.
 *  - Adiantamento (opcional) → dia 20 do mês de competência.
 *  - GPS/GRF/DARF → dia 20 do mês seguinte.
 *  - VT/VR/VA → último dia útil do mês anterior.
 *  - Plano de saúde → dia 10 do mês de competência.
 */
export function usePayrollProjections(rangeFrom?: Date, rangeTo?: Date) {
  const { currentOrg } = useOrganization();
  const employeesQuery = useEmployees();
  const dpConfigQuery = useDPConfig();
  const employeeBenefitsQuery = useEmployeeBenefits();

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

    const advanceEnabled = !!(config as any)?.advance_enabled;
    const advancePct = Number((config as any)?.advance_pct ?? 40);

    const acctSalario = (config as any)?.default_account_salario ?? null;
    const acctEncargos = (config as any)?.default_account_encargos ?? null;
    const acctBeneficios = (config as any)?.default_account_beneficios ?? null;

    // Index benefits per employee, segregated by sub-category.
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

    // Index events per employee per month.
    const eventsByEmpMonth = new Map<string, any[]>();
    for (const ev of events) {
      const monthKey = (ev.reference_month || "").slice(0, 7);
      if (!monthKey) continue;
      const key = `${ev.employee_id}:${monthKey}`;
      const arr = eventsByEmpMonth.get(key) ?? [];
      arr.push(ev);
      eventsByEmpMonth.set(key, arr);
    }

    const entries: (Omit<CashFlowEntry, "user_id" | "organization_id"> & { dp_sub_category?: string })[] = [];
    const activeEmployees = employees.filter((e) => e.status === "ativo");
    const now = new Date().toISOString();

    let cursor = startOfMonth(rangeFrom);
    while (!isAfter(cursor, rangeTo)) {
      const monthKey = format(cursor, "yyyy-MM");
      const monthLabel = format(cursor, "MM/yyyy");
      const competencyLong = formatCompetencyLong(cursor);

      // Datas de desembolso para esta competência.
      const dtSalario = fmtISO(salaryPaymentDate(cursor, config as any));
      const dtAdiant = fmtISO(advancePaymentDate(cursor, config as any));
      const dtINSS = fmtISO(inssDueDate(cursor, config as any));
      const dtFGTS = fmtISO(fgtsDueDate(cursor, config as any));
      const dtIRRF = fmtISO(irrfDueDate(cursor, config as any));
      const dtBeneficios = fmtISO(benefitsPaymentDate(cursor, config as any));
      const dtSaude = fmtISO(healthPaymentDate(cursor, config as any));
      const dtCompetencia = fmtISO(startOfMonth(cursor));

      // Acumuladores para guias consolidadas (toda a empresa em uma só linha).
      let totalInssEmp = 0;
      let totalInssPatronal = 0;
      let totalRat = 0;
      let totalTerceiros = 0;
      let totalFgts = 0;
      let totalIrrf = 0;
      let countInssEmployees = 0;
      let countFgtsEmployees = 0;

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

        // PJ: pagamento bruto único na data do salário.
        if (isPJ) {
          entries.push({
            id: `proj-dp-pj-${emp.id}-${monthKey}`,
            contract_id: null,
            contract_installment_id: null,
            tipo: "saida",
            categoria: "Pessoal",
            descricao: `Prestação de Serviço PJ — ${emp.name} (competência ${monthLabel})`,
            valor_previsto: round2(salary),
            valor_realizado: null,
            data_prevista: dtSalario,
            data_realizada: null,
            status: "previsto",
            account_id: acctSalario,
            cost_center_id: emp.cost_center_id ?? null,
            entity_id: null,
            notes: `Pagamento bruto contratual referente à competência ${competencyLong} — sem encargos trabalhistas`,
            source: "dp",
            source_ref: projectionKey.payroll(emp.id, "salario_liquido", monthKey),
            dp_sub_category: "salario_liquido",
            reference_month: dtCompetencia,
            created_at: now,
            updated_at: now,
          } as any);
          continue;
        }

        // Eventos do mês para esse colaborador → entram no cálculo do líquido.
        const empEvents = (eventsByEmpMonth.get(`${emp.id}:${monthKey}`) ?? []).map((ev) => ({
          signal: ev.signal as "provento" | "desconto",
          value: Number(ev.value || 0),
          tributavel: isEventTributavel(ev.event_type),
          event_type: ev.event_type,
        }));

        // VT bruto baseado em dias úteis do mês.
        const businessDays = getBusinessDays(cursor);
        const vtBruto = emp.vt_ativo && emp.vt_diario > 0 ? Number(emp.vt_diario) * businessDays : 0;

        const calc = calcEmployeeNet({
          salaryBase: salary,
          contractType: emp.contract_type,
          vtBruto,
          vtDescontoPct: vtDescontoPct * 100,
          events: empEvents,
          advanceEnabled,
          advancePct,
        });

        // Encargos patronais (sempre por colaborador para detalhe contábil, mas só
        // são EXPOSTOS no caixa de forma consolidada — vide guias abaixo).
        const fgtsVal = isEstagio ? 0 : salary * fgtsPct;
        const inssPatronalVal = isEstagio ? 0 : salary * inssPatronalPct;
        const ratVal = isEstagio ? 0 : salary * ratPct;
        const terceirosVal = isEstagio ? 0 : salary * terceirosPct;

        totalInssEmp += calc.inssEmp;
        totalInssPatronal += inssPatronalVal;
        totalRat += ratVal;
        totalTerceiros += terceirosVal;
        totalFgts += fgtsVal;
        totalIrrf += calc.irrf;
        if (!isEstagio) {
          countInssEmployees += 1;
          countFgtsEmployees += 1;
        }

        const baseEmp = {
          contract_id: null,
          contract_installment_id: null,
          tipo: "saida" as const,
          categoria: "Pessoal",
          valor_realizado: null,
          data_realizada: null,
          status: "previsto",
          cost_center_id: emp.cost_center_id ?? null,
          entity_id: null,
          source: "dp",
          created_at: now,
          updated_at: now,
        };

        // 1. Adiantamento (só se ativo).
        if (calc.adiantamento > 0) {
          entries.push({
            ...baseEmp,
            id: `proj-dp-adiant-${emp.id}-${monthKey}`,
            descricao: `Adiantamento (vale ${advancePct.toFixed(0)}%) — ${emp.name}`,
            valor_previsto: calc.adiantamento,
            data_prevista: dtAdiant,
            account_id: acctSalario,
            notes: `Vale pago em ${dtAdiant} — saldo líquido: ${calc.saldo.toFixed(0)}`,
            dp_sub_category: "salario_adiantamento",
            source_ref: projectionKey.payroll(emp.id, "salario_adiantamento", monthKey),
          } as any);
        }

        // 2. Salário líquido (saldo, ou líquido total se sem adiantamento).
        const salNotes = `Base: ${salary.toFixed(0)} | INSS Emp: ${calc.inssEmp.toFixed(0)} | IRRF: ${calc.irrf.toFixed(0)}${calc.vtDesconto > 0 ? ` | VT Desc: ${calc.vtDesconto.toFixed(0)}` : ""}${calc.proventosTributaveis + calc.proventosNaoTributaveis > 0 ? ` | Proventos: ${(calc.proventosTributaveis + calc.proventosNaoTributaveis).toFixed(0)}` : ""}${calc.descontosVariaveis > 0 ? ` | Descontos: ${calc.descontosVariaveis.toFixed(0)}` : ""}${calc.adiantamento > 0 ? ` | (-) Adiant: ${calc.adiantamento.toFixed(0)}` : ""} | Líquido total: ${calc.liquido.toFixed(0)}`;
        if (calc.saldo > 0) {
          entries.push({
            ...baseEmp,
            id: `proj-dp-sal-${emp.id}-${monthKey}`,
            descricao: calc.adiantamento > 0 ? `Salário (saldo) — ${emp.name}` : `Salário Líquido — ${emp.name}`,
            valor_previsto: calc.saldo,
            data_prevista: dtSalario,
            account_id: acctSalario,
            notes: salNotes,
            dp_sub_category: "salario_liquido",
            source_ref: projectionKey.payroll(emp.id, "salario_liquido", monthKey),
          } as any);
        }

        // 3. VT (líquido) — crédito antecipado.
        if (vtBruto > 0) {
          const vtNet = Math.max(0, vtBruto - calc.vtDesconto);
          if (vtNet > 0) {
            entries.push({
              ...baseEmp,
              id: `proj-dp-vt-${emp.id}-${monthKey}`,
              descricao: `VT — ${emp.name}`,
              valor_previsto: round2(vtNet),
              data_prevista: dtBeneficios,
              account_id: acctBeneficios,
              notes: `${businessDays} dias úteis × R$${Number(emp.vt_diario).toFixed(2)} = ${vtBruto.toFixed(0)} | Desc 6%: ${calc.vtDesconto.toFixed(0)} | Líq: ${vtNet.toFixed(0)}`,
              dp_sub_category: "vt",
              source_ref: projectionKey.payroll(emp.id, "vt", monthKey),
            } as any);
          }
        }

        // 4. Benefícios — segregados por categoria contábil.
        const empBenefitsBySub = benefitsByEmployee.get(emp.id);
        if (empBenefitsBySub) {
          for (const [sub, total] of empBenefitsBySub.entries()) {
            if (total <= 0) continue;
            const dt = sub === "beneficios_saude" ? dtSaude : dtBeneficios;
            const label =
              sub === "beneficios_vr" ? "VR"
              : sub === "beneficios_va" ? "VA"
              : sub === "beneficios_saude" ? "Saúde"
              : "Benefícios";
            entries.push({
              ...baseEmp,
              id: `proj-dp-${sub}-${emp.id}-${monthKey}`,
              descricao: `${label} — ${emp.name}`,
              valor_previsto: round2(total),
              data_prevista: dt,
              account_id: acctBeneficios,
              notes: null,
              dp_sub_category: sub,
              source_ref: projectionKey.payroll(emp.id, sub, monthKey),
            } as any);
          }
        }

        // 5. Provisões 13º + Férias (informativo, não soma no caixa).
        const provisoes = isEstagio ? 0 : salary * (provisao13Pct + provisaoFeriasPct);
        if (provisoes > 0) {
          entries.push({
            ...baseEmp,
            id: `proj-dp-provisoes-${emp.id}-${monthKey}`,
            descricao: `Provisão Acumulada (13º + Férias) — ${emp.name}`,
            valor_previsto: round2(provisoes),
            data_prevista: dtCompetencia,
            account_id: acctEncargos,
            notes: "Informativo — compõe passivo trabalhista, não soma no caixa",
            dp_sub_category: "provisao_acumulada",
            source_ref: projectionKey.payroll(emp.id, "provisao_acumulada", monthKey),
          } as any);
        }
      }

      // ===== Guias consolidadas (uma única saída por mês, como acontece no banco) =====
      const baseGuia = {
        contract_id: null,
        contract_installment_id: null,
        tipo: "saida" as const,
        categoria: "Pessoal",
        valor_realizado: null,
        data_realizada: null,
        status: "previsto",
        cost_center_id: null, // guias são corporativas, não rateadas por CC
        entity_id: null,
        source: "dp",
        created_at: now,
        updated_at: now,
        account_id: acctEncargos,
      };

      // GPS = INSS Empregado + INSS Patronal + RAT + Terceiros (sistema S)
      const gpsTotal = totalInssEmp + totalInssPatronal + totalRat + totalTerceiros;
      if (gpsTotal > 0) {
        entries.push({
          ...baseGuia,
          id: `proj-dp-gps-${currentOrg!.id}-${monthKey}`,
          descricao: `GPS (INSS) — competência ${monthLabel}`,
          valor_previsto: round2(gpsTotal),
          data_prevista: dtINSS,
          notes: `Guia única — ${countInssEmployees} colaborador(es) | Patronal: ${totalInssPatronal.toFixed(0)} | Empregado: ${totalInssEmp.toFixed(0)} | RAT: ${totalRat.toFixed(0)} | Terceiros: ${totalTerceiros.toFixed(0)}`,
          dp_sub_category: "encargos_inss",
          source_ref: `gps:${currentOrg!.id}:${monthKey}`,
        } as any);
      }

      // GRF = FGTS consolidado.
      if (totalFgts > 0) {
        entries.push({
          ...baseGuia,
          id: `proj-dp-grf-${currentOrg!.id}-${monthKey}`,
          descricao: `GRF (FGTS) — competência ${monthLabel}`,
          valor_previsto: round2(totalFgts),
          data_prevista: dtFGTS,
          notes: `Guia única — ${countFgtsEmployees} colaborador(es) | FGTS 8% s/ folha base`,
          dp_sub_category: "encargos_fgts",
          source_ref: `grf:${currentOrg!.id}:${monthKey}`,
        } as any);
      }

      // DARF IRRF = IRRF retido consolidado (código 0561).
      if (totalIrrf > 0) {
        entries.push({
          ...baseGuia,
          id: `proj-dp-darf-irrf-${currentOrg!.id}-${monthKey}`,
          descricao: `DARF IRRF — competência ${monthLabel}`,
          valor_previsto: round2(totalIrrf),
          data_prevista: dtIRRF,
          notes: `Guia única — IRRF retido na fonte (código 0561)`,
          dp_sub_category: "encargos_irrf",
          source_ref: `darf-irrf:${currentOrg!.id}:${monthKey}`,
        } as any);
      }

      cursor = addMonths(cursor, 1);
    }

    return entries;
  }, [employees, config, employeeBenefits, events, rangeFrom, rangeTo, currentOrg]);

  const monthlyPayrollTotal = useMemo(() => {
    return projections
      .filter((p) => p.dp_sub_category !== "provisao_acumulada")
      .reduce((sum, p) => sum + Number(p.valor_previsto), 0);
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

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export { SUB_CATEGORY_LABELS };
