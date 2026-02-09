import { PageHeader } from "@/components/PageHeader";
import { KPICard } from "@/components/KPICard";
import { kpiData, monthlyRevenue, expenseByCategory } from "@/data/mockData";
import { DollarSign, TrendingUp, Wallet, PiggyBank, Building2, Plus } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { currentOrg, organizations } = useOrganization();
  const navigate = useNavigate();

  if (organizations.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Dashboard Financeiro" description="Bem-vindo ao FinCore" />
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Cadastre sua primeira empresa</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Para começar a usar o Colli FinCore, cadastre uma empresa. Você poderá gerenciar múltiplas empresas
            posteriormente.
          </p>
          <Button onClick={() => navigate("/nova-empresa")} className="mt-2">
            <Plus size={16} className="mr-2" /> Cadastrar Empresa
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard Financeiro"
        description={currentOrg ? `Visão consolidada — ${currentOrg.name}` : "Visão consolidada da saúde financeira"}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receita Total"
          value={kpiData.receita.value}
          change={kpiData.receita.change}
          subtitle={kpiData.receita.subtitle}
          icon={<DollarSign size={20} />}
        />
        <KPICard
          title="Despesas"
          value={kpiData.despesas.value}
          change={kpiData.despesas.change}
          subtitle={kpiData.despesas.subtitle}
          icon={<TrendingUp size={20} />}
        />
        <KPICard
          title="Lucro Líquido"
          value={kpiData.lucroLiquido.value}
          change={kpiData.lucroLiquido.change}
          subtitle={kpiData.lucroLiquido.subtitle}
          icon={<PiggyBank size={20} />}
        />
        <KPICard
          title="Saldo em Caixa"
          value={kpiData.saldoCaixa.value}
          change={kpiData.saldoCaixa.change}
          subtitle={kpiData.saldoCaixa.subtitle}
          icon={<Wallet size={20} />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Expenses */}
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Receita vs Despesas</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215, 20%, 55%)" }} />
              <Bar dataKey="receita" name="Receita" fill="hsl(174, 72%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="hsl(262, 60%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Despesas por Categoria</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={expenseByCategory}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {expenseByCategory.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {expenseByCategory.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: cat.fill }} />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-medium text-foreground">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Evolução da Receita</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyRevenue}>
            <defs>
              <linearGradient id="receitaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }}
              tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="receita"
              name="Receita"
              stroke="hsl(174, 72%, 50%)"
              fill="url(#receitaGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
