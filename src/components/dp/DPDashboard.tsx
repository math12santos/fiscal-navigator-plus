import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployees, usePayrollRuns, useDPConfig, calcEncargosPatronais } from "@/hooks/useDP";
import { useEmployeeBenefits, useDPBenefits } from "@/hooks/useDPBenefits";
import { Users, DollarSign, TrendingUp, Percent, Bus, UtensilsCrossed, HeartPulse } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useCostCenters } from "@/hooks/useCostCenters";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#8884d8", "#82ca9d", "#ffc658"];
const DIAS_UTEIS_MES = 22;

export default function DPDashboard() {
  const { data: employees = [] } = useEmployees();
  const { data: payrollRuns = [] } = usePayrollRuns();
  const { data: dpConfig } = useDPConfig();
  const { costCenters = [] } = useCostCenters();
  const { data: allBenefits = [] } = useDPBenefits();
  const { data: allEmployeeBenefits = [] } = useEmployeeBenefits();

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
  }, [activeEmployees]);

  // Benefits totals by name (VA, Plano de Saúde, etc.)
  const benefitStats = useMemo(() => {
    const benefitMap: Record<string, { name: string; count: number; custoTotal: number }> = {};
    allEmployeeBenefits.forEach((eb: any) => {
      const benefit = allBenefits.find((b: any) => b.id === eb.benefit_id);
      if (!benefit || !benefit.active) return;
      const emp = activeEmployees.find((e: any) => e.id === eb.employee_id);
      if (!emp || !eb.active) return;
      if (!benefitMap[benefit.id]) benefitMap[benefit.id] = { name: benefit.name, count: 0, custoTotal: 0 };
      benefitMap[benefit.id].count++;
      const valor = eb.custom_value != null ? Number(eb.custom_value) : Number(benefit.default_value);
      if (benefit.type === "percentual") {
        benefitMap[benefit.id].custoTotal += Number(emp.salary_base || 0) * (valor / 100);
      } else {
        benefitMap[benefit.id].custoTotal += valor;
      }
    });
    return Object.values(benefitMap);
  }, [allEmployeeBenefits, allBenefits, activeEmployees]);

  // Find specific well-known benefits for dedicated cards
  const findBenefit = (keywords: string[]) => benefitStats.find((b) => keywords.some((k) => b.name.toLowerCase().includes(k)));
  const vaStats = findBenefit(["alimentação", "alimentacao", "refeição", "refeicao", "vale alimentação", "vale refeição", "va", "vr"]);
  const saudeStats = findBenefit(["saúde", "saude", "plano de saúde", "health"]);
  const otherBenefits = benefitStats.filter((b) => b !== vaStats && b !== saudeStats);

  const costCenterMap = useMemo(() => {
    const map: Record<string, string> = {};
    costCenters.forEach((cc: any) => { map[cc.id] = cc.name; });
    return map;
  }, [costCenters]);

  const custoPorCC = useMemo(() => {
    const map: Record<string, number> = {};
    activeEmployees.forEach((e: any) => {
      const ccName = e.cost_center_id ? costCenterMap[e.cost_center_id] || "Sem CC" : "Sem CC";
      map[ccName] = (map[ccName] || 0) + Number(e.salary_base || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [activeEmployees, costCenterMap]);

  const folhaLiquida = activeEmployees.map((e: any) => ({
    name: e.name.split(" ").slice(0, 2).join(" "),
    salario: Number(e.salary_base || 0),
  })).sort((a: any, b: any) => b.salario - a.salario);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={Users} label="Headcount Ativo" value={String(activeEmployees.length)} />
        <KPICard icon={DollarSign} label="Folha Bruta Total" value={fmt(totalFolhaBruta)} />
        <KPICard icon={TrendingUp} label="Encargos Totais" value={fmt(encargosTotal)} />
        <KPICard icon={Percent} label="Custo Médio/Colab." value={fmt(custoMedioPorColab)} />
      </div>

      {/* Benefícios KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={Bus} label="Vale Transporte" value={fmt(vtStats.custoTotal)} subtitle={`${vtStats.count} colaborador(es)`} />
        <KPICard icon={UtensilsCrossed} label={vaStats?.name || "Vale Alimentação"} value={fmt(vaStats?.custoTotal || 0)} subtitle={`${vaStats?.count || 0} colaborador(es)`} />
        <KPICard icon={HeartPulse} label={saudeStats?.name || "Plano de Saúde"} value={fmt(saudeStats?.custoTotal || 0)} subtitle={`${saudeStats?.count || 0} colaborador(es)`} />
        {otherBenefits.length > 0 ? (
          <KPICard icon={DollarSign} label="Outros Benefícios" value={fmt(otherBenefits.reduce((s, b) => s + b.custoTotal, 0))} subtitle={`${otherBenefits.length} tipo(s)`} />
        ) : (
          <KPICard icon={DollarSign} label="Total Benefícios" value={fmt(vtStats.custoTotal + (vaStats?.custoTotal || 0) + (saudeStats?.custoTotal || 0))} subtitle="Custo mensal" />
        )}
      </div>

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
          <CardHeader><CardTitle className="text-sm">Custo por Centro de Custo</CardTitle></CardHeader>
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

function KPICard({ icon: Icon, label, value, subtitle }: { icon: any; label: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
