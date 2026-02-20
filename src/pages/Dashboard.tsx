import { PageHeader } from "@/components/PageHeader";
import { KPICard } from "@/components/KPICard";
import { DollarSign, TrendingUp, Wallet, PiggyBank, Building2, Plus } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useMemo } from "react";
import { startOfMonth, subMonths, endOfMonth, format, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const shortMonth = (d: Date) => format(d, "MMM", { locale: ptBR }).replace(".", "");

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

  // Range: last 6 months including current
  const now = new Date();
  const rangeFrom = startOfMonth(subMonths(now, 5));
  const rangeTo = endOfMonth(now);

  const { entries, totals, isLoading } = useCashFlow(rangeFrom, rangeTo);

  // Previous month range for comparison
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));
  const curMonthStart = startOfMonth(now);
  const curMonthEnd = endOfMonth(now);

  const { currentMonth, previousMonth } = useMemo(() => {
    let curEntradas = 0, curSaidas = 0, prevEntradas = 0, prevSaidas = 0;
    for (const e of entries) {
      const d = e.data_prevista;
      const val = e.valor_realizado ?? e.valor_previsto;
      const v = Number(val);
      if (d >= format(curMonthStart, "yyyy-MM-dd") && d <= format(curMonthEnd, "yyyy-MM-dd")) {
        if (e.tipo === "entrada") curEntradas += v; else curSaidas += v;
      }
      if (d >= format(prevMonthStart, "yyyy-MM-dd") && d <= format(prevMonthEnd, "yyyy-MM-dd")) {
        if (e.tipo === "entrada") prevEntradas += v; else prevSaidas += v;
      }
    }
    return {
      currentMonth: { entradas: curEntradas, saidas: curSaidas, lucro: curEntradas - curSaidas },
      previousMonth: { entradas: prevEntradas, saidas: prevSaidas, lucro: prevEntradas - prevSaidas },
    };
  }, [entries, curMonthStart, curMonthEnd, prevMonthStart, prevMonthEnd]);

  const pctChange = (cur: number, prev: number) =>
    prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 1000) / 10;

  // Monthly aggregation for charts
  const monthlyData = useMemo(() => {
    const months: Record<string, { receita: number; despesas: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(now, i), "yyyy-MM");
      months[key] = { receita: 0, despesas: 0 };
    }
    for (const e of entries) {
      const key = e.data_prevista.substring(0, 7);
      if (months[key]) {
        const val = Number(e.valor_realizado ?? e.valor_previsto);
        if (e.tipo === "entrada") months[key].receita += val;
        else months[key].despesas += val;
      }
    }
    return Object.entries(months).map(([key, v]) => ({
      month: shortMonth(new Date(key + "-01")),
      receita: v.receita,
      despesas: v.despesas,
    }));
  }, [entries]);

  // Expense by category (current month)
  const expenseByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const e of entries) {
      const d = e.data_prevista;
      if (d >= format(curMonthStart, "yyyy-MM-dd") && d <= format(curMonthEnd, "yyyy-MM-dd") && e.tipo === "saida") {
        const cat = e.categoria || "Outros";
        cats[cat] = (cats[cat] || 0) + Number(e.valor_realizado ?? e.valor_previsto);
      }
    }
    const colors = [
      "hsl(174, 72%, 50%)", "hsl(152, 60%, 45%)", "hsl(38, 92%, 55%)",
      "hsl(262, 60%, 55%)", "hsl(0, 72%, 55%)", "hsl(200, 60%, 50%)",
    ];
    return Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }));
  }, [entries, curMonthStart, curMonthEnd]);

  if (organizations.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Dashboard Financeiro" description="Bem-vindo ao Colli FinCore" />
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Cadastre sua primeira empresa</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Para começar a usar o FinCore, cadastre uma empresa. Você poderá gerenciar múltiplas empresas
            posteriormente.
          </p>
          <Button onClick={() => navigate("/app/nova-empresa")} className="mt-2">
            <Plus size={16} className="mr-2" /> Cadastrar Empresa
          </Button>
        </div>
      </div>
    );
  }

  const noData = entries.length === 0 && !isLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard Financeiro"
        description={currentOrg ? `Visão consolidada — ${currentOrg.name}` : "Visão consolidada da saúde financeira"}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receita Mensal"
          value={formatCurrency(currentMonth.entradas)}
          change={pctChange(currentMonth.entradas, previousMonth.entradas)}
          subtitle="vs mês anterior"
          icon={<DollarSign size={20} />}
        />
        <KPICard
          title="Despesas Mensais"
          value={formatCurrency(currentMonth.saidas)}
          change={pctChange(currentMonth.saidas, previousMonth.saidas)}
          subtitle="vs mês anterior"
          icon={<TrendingUp size={20} />}
        />
        <KPICard
          title="Resultado Mensal"
          value={formatCurrency(currentMonth.lucro)}
          change={pctChange(currentMonth.lucro, previousMonth.lucro)}
          subtitle="vs mês anterior"
          icon={<PiggyBank size={20} />}
        />
        <KPICard
          title="Saldo Período"
          value={formatCurrency(totals.saldo)}
          change={0}
          subtitle="últimos 6 meses"
          icon={<Wallet size={20} />}
        />
      </div>

      {noData && (
        <div className="glass-card p-6 text-center text-muted-foreground text-sm">
          Nenhum lançamento encontrado. Cadastre contratos ou lançamentos no Fluxo de Caixa para ver dados aqui.
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Expenses */}
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Receita vs Despesas</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }}
                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
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
          {expenseByCategory.length > 0 ? (
            <>
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
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              Sem despesas no mês atual
            </div>
          )}
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Evolução da Receita</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyData}>
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
              tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
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
