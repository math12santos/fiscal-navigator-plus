import { useMemo } from "react";
import { useEmployees, useDPConfig, calcEncargosPatronais } from "@/hooks/useDP";
import { useEmployeeBenefits, useDPBenefits } from "@/hooks/useDPBenefits";
import { useExpiringDocuments } from "@/hooks/useEmployeeDocuments";
import { usePayrollEvents, summarizeEvents } from "@/hooks/usePayrollEvents";
import { useCostCenters } from "@/hooks/useCostCenters";
import { format } from "date-fns";

const DIAS_UTEIS_MES = 22;

/**
 * Consolida indicadores do módulo DP para exibição no Dashboard global.
 * Não duplica cálculo — reaproveita os hooks já existentes do DP.
 */
export function useDPCockpit() {
  const { data: employees = [] } = useEmployees();
  const { data: dpConfig } = useDPConfig();
  const { data: allBenefits = [] } = useDPBenefits();
  const { data: allEmployeeBenefits = [] } = useEmployeeBenefits();
  const { data: expiringDocs = [] } = useExpiringDocuments(60);
  const { data: monthEvents = [] } = usePayrollEvents();
  const { costCenters = [] } = useCostCenters();

  const referenceMonth = format(new Date(), "yyyy-MM");

  return useMemo(() => {
    const active = employees.filter((e: any) => e.status === "ativo");

    const folhaBruta = active.reduce(
      (s: number, e: any) => s + Number(e.salary_base || 0),
      0,
    );

    const encargos = active.reduce((s: number, e: any) => {
      const enc = calcEncargosPatronais(
        Number(e.salary_base || 0),
        dpConfig,
        e.contract_type,
      );
      return s + enc.total;
    }, 0);

    // VT
    const vtCusto = active.reduce((s: number, e: any) => {
      if (!e.vt_ativo) return s;
      const bruto = Number(e.vt_diario || 0) * DIAS_UTEIS_MES;
      const desc = Number(e.salary_base || 0) * 0.06;
      return s + Math.max(bruto - desc, 0);
    }, 0);

    // Benefícios (soma de todos)
    let beneficiosCusto = 0;
    allEmployeeBenefits.forEach((eb: any) => {
      if (!eb.active) return;
      const benefit = allBenefits.find((b: any) => b.id === eb.benefit_id);
      const emp = active.find((e: any) => e.id === eb.employee_id);
      if (!benefit || !emp || !benefit.active) return;
      const valor = eb.custom_value != null ? Number(eb.custom_value) : Number(benefit.default_value);
      beneficiosCusto += benefit.type === "percentual"
        ? Number(emp.salary_base || 0) * (valor / 100)
        : valor;
    });

    // Eventos do mês corrente
    const monthScopedEvents = monthEvents.filter(
      (ev: any) => ev.reference_month === referenceMonth,
    );
    const eventsSummary = summarizeEvents(monthScopedEvents as any);

    const custoTotal =
      folhaBruta + encargos + vtCusto + beneficiosCusto + eventsSummary.liquido;

    // Documentos vencidos / críticos
    const today = new Date().toISOString().slice(0, 10);
    const docVencidos = expiringDocs.filter((d: any) => d.expires_at < today).length;
    const docCriticos = expiringDocs.filter((d: any) => {
      if (d.expires_at < today) return false;
      const diff = (new Date(d.expires_at).getTime() - Date.now()) / 86400000;
      return diff <= 15;
    }).length;
    const docProximos = expiringDocs.length - docVencidos - docCriticos;

    // Top 3 centros de custo por valor de folha
    const ccMap: Record<string, { name: string; value: number; count: number }> = {};
    active.forEach((e: any) => {
      const ccName = e.cost_center_id
        ? costCenters.find((c: any) => c.id === e.cost_center_id)?.name || "Sem CC"
        : "Sem CC";
      if (!ccMap[ccName]) ccMap[ccName] = { name: ccName, value: 0, count: 0 };
      ccMap[ccName].value += Number(e.salary_base || 0);
      ccMap[ccName].count += 1;
    });
    const topCostCenters = Object.values(ccMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    const custoMedio = active.length > 0 ? custoTotal / active.length : 0;

    return {
      headcount: active.length,
      folhaBruta,
      encargos,
      vtCusto,
      beneficiosCusto,
      eventosLiquido: eventsSummary.liquido,
      eventosCount: monthScopedEvents.length,
      custoTotal,
      custoMedio,
      docVencidos,
      docCriticos,
      docProximos,
      docTotal: expiringDocs.length,
      topCostCenters,
      hasData: active.length > 0,
    };
  }, [employees, dpConfig, allBenefits, allEmployeeBenefits, expiringDocs, monthEvents, costCenters, referenceMonth]);
}
