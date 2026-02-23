import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployees, usePayrollRuns, useDPConfig, calcEncargosPatronais } from "@/hooks/useDP";
import { Users, DollarSign, TrendingUp, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useCostCenters } from "@/hooks/useCostCenters";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#8884d8", "#82ca9d", "#ffc658"];

export default function DPDashboard() {
  const { data: employees = [] } = useEmployees();
  const { data: payrollRuns = [] } = usePayrollRuns();
  const { data: dpConfig } = useDPConfig();
  const { costCenters = [] } = useCostCenters();

  const activeEmployees = employees.filter((e: any) => e.status === "ativo");
  const totalFolhaBruta = activeEmployees.reduce((sum: number, e: any) => sum + Number(e.salary_base || 0), 0);

  const encargosTotal = activeEmployees.reduce((sum: number, e: any) => {
    const enc = calcEncargosPatronais(Number(e.salary_base || 0), dpConfig);
    return sum + enc.total;
  }, 0);

  const custoMedioPorColab = activeEmployees.length > 0 ? (totalFolhaBruta + encargosTotal) / activeEmployees.length : 0;

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

function KPICard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
