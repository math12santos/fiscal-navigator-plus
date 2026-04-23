import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployees, usePayrollRuns, useDPConfig, calcEncargosPatronais } from "@/hooks/useDP";
import { useEmployeeBenefits, useDPBenefits } from "@/hooks/useDPBenefits";
import { Users, DollarSign, TrendingUp, Percent, Bus, UtensilsCrossed, HeartPulse } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { dpFmt, generateDPExcelReport, generateDPPdfReport } from "@/lib/dpExports";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DPDocumentAlerts from "./DPDocumentAlerts";
import { KPICard } from "@/components/KPICard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useBusinessDaysForMonth } from "@/hooks/useBusinessDays";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#8884d8", "#82ca9d", "#ffc658"];

export default function DPDashboard() {
  const navigate = useNavigate();
  const { data: employees = [] } = useEmployees();
  const { data: payrollRuns = [] } = usePayrollRuns();
  const { data: dpConfig } = useDPConfig();
  const { costCenters = [] } = useCostCenters();
  const { data: allBenefits = [] } = useDPBenefits();
  const { data: allEmployeeBenefits = [] } = useEmployeeBenefits();
  const { currentOrg } = useOrganization();
  // Dias úteis efetivos do mês corrente (override organizacional > automático)
  const businessDaysInfo = useBusinessDaysForMonth(new Date());
  const DIAS_UTEIS_MES = businessDaysInfo.days;

  const activeEmployees = employees.filter((e: any) => e.status === "ativo");
  const totalFolhaBruta = activeEmployees.reduce((sum: number, e: any) => sum + Number(e.salary_base || 0), 0);

  const encargosTotal = activeEmployees.reduce((sum: number, e: any) => {
    const enc = calcEncargosPatronais(Number(e.salary_base || 0), dpConfig, e.contract_type);
    return sum + enc.total;
  }, 0);

  const custoMedioPorColab = activeEmployees.length > 0 ? (totalFolhaBruta + encargosTotal) / activeEmployees.length : 0;

  // VT totals
  const vtStats = useMemo(() => {
    const vtAtivos = activeEmployees.filter((e: any) => e.vt_ativo);
    const custoTotal = vtAtivos.reduce((sum: number, e: any) => {
      const vtMensal = Number(e.vt_diario || 0) * DIAS_UTEIS_MES;
      const desconto = Number(e.salary_base || 0) * 0.06;
      return sum + Math.max(vtMensal - desconto, 0);
    }, 0);
    return { count: vtAtivos.length, custoTotal };
  }, [activeEmployees, DIAS_UTEIS_MES]);

  // Benefits totals by name (VA, Plano de Saúde, etc.)
  // `hasPorDia` indica se algum benefício do grupo é "por dia útil" — quando
  // verdadeiro, o cálculo é valor/dia × dias úteis efetivos do mês corrente
  // (mesma fonte da projeção e do drill-down `dp-va` no RelatorioKpi).
  const benefitStats = useMemo(() => {
    const benefitMap: Record<string, { name: string; count: number; custoTotal: number; type: string; hasPorDia: boolean }> = {};
    allEmployeeBenefits.forEach((eb: any) => {
      const benefit = allBenefits.find((b: any) => b.id === eb.benefit_id);
      if (!benefit || !benefit.active) return;
      const emp = activeEmployees.find((e: any) => e.id === eb.employee_id);
      if (!emp || !eb.active) return;
      if (!benefitMap[benefit.id]) benefitMap[benefit.id] = { name: benefit.name, count: 0, custoTotal: 0, type: benefit.type, hasPorDia: false };
      benefitMap[benefit.id].count++;
      const valor = eb.custom_value != null ? Number(eb.custom_value) : Number(benefit.default_value);
      if (benefit.type === "percentual") {
        benefitMap[benefit.id].custoTotal += Number(emp.salary_base || 0) * (valor / 100);
      } else if (benefit.type === "por_dia") {
        benefitMap[benefit.id].custoTotal += valor * DIAS_UTEIS_MES;
        benefitMap[benefit.id].hasPorDia = true;
      } else {
        benefitMap[benefit.id].custoTotal += valor;
      }
    });
    return Object.values(benefitMap);
  }, [allEmployeeBenefits, allBenefits, activeEmployees, DIAS_UTEIS_MES]);

  // Find specific well-known benefits for dedicated cards
  const findBenefit = (keywords: string[]) => benefitStats.find((b) => keywords.some((k) => b.name.toLowerCase().includes(k)));
  const vaStats = findBenefit(["alimentação", "alimentacao", "refeição", "refeicao", "vale alimentação", "vale refeição", "va", "vr"]);
  const saudeStats = findBenefit(["saúde", "saude", "plano de saúde", "health"]);
  const otherBenefits = benefitStats.filter((b) => b !== vaStats && b !== saudeStats);

  // Total geral de benefícios (todos os benefícios + VT) — usado no fallback do card "Total Benefícios"
  const totalBeneficiosGeral = useMemo(
    () => vtStats.custoTotal + benefitStats.reduce((s, b) => s + b.custoTotal, 0),
    [vtStats.custoTotal, benefitStats],
  );

  const costCenterMap = useMemo(() => {
    const map: Record<string, string> = {};
    costCenters.forEach((cc: any) => { map[cc.id] = cc.name; });
    return map;
  }, [costCenters]);

  // Visão de custo por CC: "salario" (apenas salário base) ou "total" (salário + encargos)
  const [ccView, setCcView] = useState<"salario" | "total">("salario");

  const custoPorCC = useMemo(() => {
    const map: Record<string, { salario: number; total: number }> = {};
    activeEmployees.forEach((e: any) => {
      const ccName = e.cost_center_id ? costCenterMap[e.cost_center_id] || "Sem CC" : "Sem CC";
      const sal = Number(e.salary_base || 0);
      const enc = calcEncargosPatronais(sal, dpConfig, e.contract_type);
      if (!map[ccName]) map[ccName] = { salario: 0, total: 0 };
      map[ccName].salario += sal;
      map[ccName].total += sal + enc.total;
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      value: ccView === "total" ? v.total : v.salario,
      salario: v.salario,
      total: v.total,
    }));
  }, [activeEmployees, costCenterMap, dpConfig, ccView]);

  const folhaLiquida = activeEmployees.map((e: any) => ({
    name: e.name.split(" ").slice(0, 2).join(" "),
    salario: Number(e.salary_base || 0),
  })).sort((a: any, b: any) => b.salario - a.salario);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ---------- Exports ----------
  const exportPdf = () => {
    const period = format(new Date(), "MMMM/yyyy", { locale: ptBR });
    generateDPPdfReport({
      title: "Headcount e Custos por Centro de Custo",
      orgName: currentOrg?.name || "—",
      period,
      summary: [
        { label: "Headcount Ativo", value: String(activeEmployees.length) },
        { label: "Folha Bruta", value: fmt(totalFolhaBruta) },
        { label: "Encargos", value: fmt(encargosTotal) },
        { label: "Custo Médio", value: fmt(custoMedioPorColab) },
      ],
      columns: ["Centro de Custo", "Salário Base (R$)", "Custo c/ Encargos (R$)", "% do Total"],
      rows: custoPorCC.map((cc) => [
        cc.name,
        fmt(cc.salario),
        fmt(cc.total),
        totalFolhaBruta > 0 ? `${((cc.salario / totalFolhaBruta) * 100).toFixed(1)}%` : "0%",
      ]),
    });
  };

  const exportExcel = () => {
    generateDPExcelReport({
      title: "Headcount e Custos DP",
      sheets: [
        {
          name: "Resumo",
          rows: [
            ["Indicador", "Valor"],
            ["Headcount Ativo", activeEmployees.length],
            ["Folha Bruta Total", totalFolhaBruta],
            ["Encargos Totais", encargosTotal],
            ["Custo Médio por Colaborador", custoMedioPorColab],
            ["Custo Total Estimado", totalFolhaBruta + encargosTotal],
          ],
        },
        {
          name: "Por Centro de Custo",
          rows: [
            ["Centro de Custo", "Salário Base", "Custo c/ Encargos", "% do Total"],
            ...custoPorCC.map((cc) => [
              cc.name,
              cc.salario,
              cc.total,
              totalFolhaBruta > 0 ? Number(((cc.salario / totalFolhaBruta) * 100).toFixed(2)) : 0,
            ]),
          ],
        },
        {
          name: "Por Colaborador",
          rows: [
            ["Colaborador", "Salário Base", "Encargos", "Custo Total"],
            ...activeEmployees.map((e: any) => {
              const sal = Number(e.salary_base || 0);
              const enc = calcEncargosPatronais(sal, dpConfig, e.contract_type);
              return [e.name, sal, enc.total, sal + enc.total];
            }),
          ],
        },
      ],
    });
  };

  const go = (m: string) => navigate(`/relatorios/kpi/${m}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Visão consolidada de pessoal — {format(new Date(), "MMMM/yyyy", { locale: ptBR })}
        </div>
        <DPExportButton onPdf={exportPdf} onExcel={exportExcel} disabled={activeEmployees.length === 0} />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={<Users size={18} />}
          title="Headcount Ativo"
          value={String(activeEmployees.length)}
          onClick={() => go("dp-headcount")}
        />
        <KPICard
          icon={<DollarSign size={18} />}
          title="Folha Bruta Total"
          value={fmt(totalFolhaBruta)}
          onClick={() => go("dp-folha-bruta")}
        />
        <KPICard
          icon={<TrendingUp size={18} />}
          title="Encargos Totais"
          value={fmt(encargosTotal)}
          onClick={() => go("dp-encargos")}
        />
        <KPICard
          icon={<Percent size={18} />}
          title="Custo Médio/Colab."
          value={fmt(custoMedioPorColab)}
          subtitle="salário + encargos"
          onClick={() => go("dp-custo-medio")}
        />
      </div>

      {/* Benefícios KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={<Bus size={18} />}
          title="Vale Transporte"
          value={fmt(vtStats.custoTotal)}
          subtitle={`${vtStats.count} colab. · ${DIAS_UTEIS_MES} dias úteis${businessDaysInfo.source === "monthly" ? " (calendário)" : ""}`}
          onClick={() => go("dp-vt")}
        />
        <KPICard
          icon={<UtensilsCrossed size={18} />}
          title={vaStats?.name || "Vale Alimentação"}
          value={fmt(vaStats?.custoTotal || 0)}
          subtitle={
            vaStats?.hasPorDia
              ? `${vaStats.count} colab. · ${DIAS_UTEIS_MES} dias úteis${businessDaysInfo.source === "monthly" ? " (calendário)" : ""}`
              : `${vaStats?.count || 0} colaborador(es)`
          }
          onClick={() => go("dp-va")}
        />
        <KPICard
          icon={<HeartPulse size={18} />}
          title={saudeStats?.name || "Plano de Saúde"}
          value={fmt(saudeStats?.custoTotal || 0)}
          subtitle={`${saudeStats?.count || 0} colaborador(es)`}
          onClick={() => go("dp-saude")}
        />
        {otherBenefits.length > 0 ? (
          <KPICard
            icon={<DollarSign size={18} />}
            title="Outros Benefícios"
            value={fmt(otherBenefits.reduce((s, b) => s + b.custoTotal, 0))}
            subtitle={`${otherBenefits.length} tipo(s)`}
            onClick={() => go("dp-outros-beneficios")}
          />
        ) : (
          <KPICard
            icon={<DollarSign size={18} />}
            title="Total Benefícios"
            value={fmt(totalBeneficiosGeral)}
            subtitle="VT + todos os benefícios"
            onClick={() => go("dp-outros-beneficios")}
          />
        )}
      </div>

      <DPDocumentAlerts />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Salários por colaborador */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Salário por Colaborador</CardTitle></CardHeader>
          <CardContent className="h-64">
            {folhaLiquida.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum colaborador cadastrado</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={folhaLiquida.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="salario" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Custo por centro de custo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Custo por Centro de Custo</CardTitle>
            <ToggleGroup
              type="single"
              size="sm"
              value={ccView}
              onValueChange={(v) => {
                if (v === "salario" || v === "total") setCcView(v);
              }}
              aria-label="Visão de custo por centro de custo"
            >
              <ToggleGroupItem value="salario" className="h-6 px-2 text-[11px]">
                Salário base
              </ToggleGroupItem>
              <ToggleGroupItem value="total" className="h-6 px-2 text-[11px]">
                Com encargos
              </ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent className="h-64">
            {custoPorCC.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={custoPorCC} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {custoPorCC.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
