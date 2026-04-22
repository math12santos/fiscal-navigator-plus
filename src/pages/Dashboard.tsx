import { PageHeader } from "@/components/PageHeader";
import { KPICard } from "@/components/KPICard";
import {
  DollarSign, TrendingUp, Wallet, PiggyBank, Building2, Plus,
  FileText, Users, AlertTriangle, Shield, Clock, Handshake,
  BarChart3, PieChart as PieChartIcon, TrendingDown, Rocket,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line,
} from "recharts";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useFinancialSummary } from "@/hooks/useFinancialSummary";
import { useGroupTotals } from "@/hooks/useGroupTotals";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useMemo, useCallback } from "react";
import { startOfMonth, subMonths, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const shortMonth = (d: Date) => format(d, "MMM", { locale: ptBR }).replace(".", "");

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1 shadow-lg">
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
  const { isHolding } = useHolding();
  const navigate = useNavigate();
  const { progress: onboardingProgress, loading: onboardingLoading } = useOnboardingProgress();

  const now = useMemo(() => new Date(), []);
  const rangeFrom = useMemo(() => startOfMonth(subMonths(now, 5)), [now]);
  const rangeTo = useMemo(() => endOfMonth(now), [now]);

  const {
    entries,
    cashflowTotals,
    activeContractsCount,
    monthlyContractValue,
    avgMonthlyPayroll,
    liabilityTotals,
    contingenciasProvaveis,
    runway,
    monthlyBurn,
    crmWeightedValue,
    alerts,
    isLoading,
  } = useFinancialSummary(rangeFrom, rangeTo);

  const { isPerCompany, groupTotals } = useGroupTotals(rangeFrom, rangeTo);

  const share = useCallback(
    (value: number, groupValue: number) => {
      if (!isPerCompany || !groupTotals || groupValue === 0) return undefined;
      return (value / groupValue) * 100;
    },
    [isPerCompany, groupTotals]
  );

  const prevMonthStart = useMemo(() => startOfMonth(subMonths(now, 1)), [now]);
  const prevMonthEnd = useMemo(() => endOfMonth(subMonths(now, 1)), [now]);
  const curMonthStart = useMemo(() => startOfMonth(now), [now]);
  const curMonthEnd = useMemo(() => endOfMonth(now), [now]);

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
    const months: Record<string, { receita: number; despesas: number; dp: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(now, i), "yyyy-MM");
      months[key] = { receita: 0, despesas: 0, dp: 0 };
    }
    for (const e of entries) {
      const key = e.data_prevista.substring(0, 7);
      if (months[key]) {
        const val = Number(e.valor_realizado ?? e.valor_previsto);
        if (e.tipo === "entrada") {
          months[key].receita += val;
        } else {
          months[key].despesas += val;
          if ((e as any).source === "dp") months[key].dp += val;
        }
      }
    }
    return Object.entries(months).map(([key, v]) => ({
      month: shortMonth(new Date(key + "-01")),
      receita: v.receita,
      despesas: v.despesas,
      resultado: v.receita - v.despesas,
      dp: v.dp,
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
        <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Cadastre sua primeira empresa</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Para começar a usar o FinCore, cadastre uma empresa. Você poderá gerenciar múltiplas empresas posteriormente.
          </p>
          <Button onClick={() => navigate("/nova-empresa")} className="mt-2">
            <Plus size={16} className="mr-2" /> Cadastrar Empresa
          </Button>
        </div>
      </div>
    );
  }

  const noData = entries.length === 0 && !isLoading;

  const alertIcon = (type: string) => {
    if (type === "danger") return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
    if (type === "warning") return <Clock className="h-4 w-4 text-warning shrink-0" />;
    return <Shield className="h-4 w-4 text-primary shrink-0" />;
  };

  const runwayAlertLevel = runway <= 3 && runway !== Infinity ? "critical" : runway <= 6 && runway !== Infinity ? "warning" : "healthy";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* BANNER ONBOARDING GUIADO */}
      {!onboardingLoading && isHolding && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Rocket size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Implantação Financeira</p>
              <p className="text-xs text-muted-foreground">
                Gerencie o onboarding de cada empresa do grupo individualmente
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("/onboarding-guiado")}>
            Ver Subsidiárias
          </Button>
        </div>
      )}
      {!onboardingLoading && !isHolding && (!onboardingProgress || onboardingProgress.status !== "concluido") && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Rocket size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Implantação Financeira</p>
              <p className="text-xs text-muted-foreground">
                {onboardingProgress
                  ? `Etapa ${onboardingProgress.current_step} de 10 — Continue a configuração do seu cockpit financeiro`
                  : "Configure seu cockpit financeiro com o onboarding guiado"}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("/onboarding-guiado")}>
            {onboardingProgress ? "Continuar" : "Iniciar"}
          </Button>
        </div>
      )}

      {/* HEADER */}
      <PageHeader
        title="Dashboard Financeiro"
        description={currentOrg ? `Visão consolidada — ${currentOrg.name}` : "Visão consolidada da empresa ou holding"}
      />

      {/* SEÇÃO 1 — KPIs PRINCIPAIS (Linha 1) */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Receita Mensal"
            value={formatCurrency(currentMonth.entradas)}
            change={pctChange(currentMonth.entradas, previousMonth.entradas)}
            subtitle="vs mês anterior"
            icon={<TrendingUp size={20} />}
            groupShare={share(currentMonth.entradas, groupTotals?.entradas ?? 0)}
            onClick={() => navigate("/relatorios/kpi/receita-mensal")}
          />
          <KPICard
            title="Despesas Mensais"
            value={formatCurrency(currentMonth.saidas)}
            change={pctChange(currentMonth.saidas, previousMonth.saidas)}
            subtitle="vs mês anterior"
            icon={<TrendingDown size={20} />}
            groupShare={share(currentMonth.saidas, groupTotals?.saidas ?? 0)}
            onClick={() => navigate("/relatorios/kpi/despesas-mensais")}
          />
          <KPICard
            title="Resultado Mensal"
            value={formatCurrency(currentMonth.lucro)}
            change={pctChange(currentMonth.lucro, previousMonth.lucro)}
            subtitle="vs mês anterior"
            icon={<PiggyBank size={20} />}
            groupShare={share(Math.abs(currentMonth.lucro), Math.abs(groupTotals?.saldo ?? 0))}
            onClick={() => navigate("/relatorios/kpi/resultado-mensal")}
          />
          <KPICard
            title="Saldo do Período"
            value={formatCurrency(cashflowTotals.saldo)}
            change={0}
            subtitle="últimos 6 meses"
            icon={<Wallet size={20} />}
            groupShare={share(cashflowTotals.saldo, groupTotals?.saldo ?? 0)}
            onClick={() => navigate("/relatorios/kpi/saldo-periodo")}
          />
        </div>

        {/* KPIs PRINCIPAIS (Linha 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Contratos Ativos"
            value={String(activeContractsCount)}
            subtitle={`${formatCurrency(monthlyContractValue)}/mês`}
            icon={<FileText size={20} />}
            groupShare={isPerCompany && groupTotals ? (activeContractsCount / groupTotals.contractsCount) * 100 : undefined}
            onClick={() => navigate("/relatorios/kpi/contratos-ativos")}
          />
          <KPICard
            title="Custo de Folha"
            value={formatCurrency(avgMonthlyPayroll)}
            subtitle="mensal estimado"
            icon={<Users size={20} />}
            groupShare={isPerCompany && groupTotals && groupTotals.payrollTotal > 0 ? (avgMonthlyPayroll / groupTotals.payrollTotal) * 100 : undefined}
            onClick={() => navigate("/relatorios/kpi/custo-folha")}
          />
          <KPICard
            title="Passivos"
            value={formatCurrency(liabilityTotals.total)}
            subtitle={contingenciasProvaveis > 0 ? `${formatCurrency(contingenciasProvaveis)} prováveis` : "Sem contingências"}
            icon={<Shield size={20} />}
            groupShare={isPerCompany && groupTotals && groupTotals.liabilitiesTotal > 0 ? (liabilityTotals.total / groupTotals.liabilitiesTotal) * 100 : undefined}
            onClick={() => navigate("/relatorios/kpi/passivos")}
          />
          <KPICard
            title="Runway"
            value={runway === Infinity ? "∞" : `${runway} meses`}
            subtitle={`burn: ${formatCurrency(monthlyBurn)}/mês`}
            icon={<AlertTriangle size={20} />}
            onClick={() => navigate("/relatorios/kpi/runway")}
          />
        </div>
      </section>

      {/* SEÇÃO 2 — INDICADORES CRÍTICOS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Passivos Highlight */}
        <div className={`rounded-xl border p-5 transition-all ${
          liabilityTotals.total > 0
            ? "bg-[hsl(30,100%,97%)] border-[hsl(30,80%,88%)] dark:bg-warning/5 dark:border-warning/20"
            : "bg-card border-border"
        }`}>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
                  <Shield size={16} className="text-warning" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passivos & Contingências</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(liabilityTotals.total)}</p>
              <p className="text-xs text-muted-foreground">
                {contingenciasProvaveis > 0
                  ? `${formatCurrency(contingenciasProvaveis)} em contingências prováveis`
                  : "Nenhuma contingência provável registrada"}
              </p>
            </div>
          </div>
        </div>

        {/* Runway Highlight */}
        <div className={`rounded-xl border p-5 transition-all ${
          runwayAlertLevel === "critical"
            ? "bg-destructive/5 border-destructive/20"
            : runwayAlertLevel === "warning"
            ? "bg-[hsl(30,100%,97%)] border-[hsl(30,80%,88%)] dark:bg-warning/5 dark:border-warning/20"
            : "bg-[hsl(174,60%,97%)] border-[hsl(174,50%,88%)] dark:bg-primary/5 dark:border-primary/20"
        }`}>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  runwayAlertLevel === "critical" ? "bg-destructive/15" : runwayAlertLevel === "warning" ? "bg-warning/15" : "bg-primary/15"
                }`}>
                  <AlertTriangle size={16} className={
                    runwayAlertLevel === "critical" ? "text-destructive" : runwayAlertLevel === "warning" ? "text-warning" : "text-primary"
                  } />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Runway Estimado</p>
              </div>
              <p className={`text-2xl font-bold ${
                runwayAlertLevel === "critical" ? "text-destructive" : runwayAlertLevel === "warning" ? "text-warning" : "text-foreground"
              }`}>
                {runway === Infinity ? "∞" : `${runway} meses`}
              </p>
              <p className="text-xs text-muted-foreground">
                Burn rate: {formatCurrency(monthlyBurn)}/mês · Saldo: {formatCurrency(cashflowTotals.saldo)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CRM Pipeline (condicional) */}
      {crmWeightedValue > 0 && (
        <div
          className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => navigate("/crm")}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline CRM</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(crmWeightedValue)}</p>
              <p className="text-xs text-muted-foreground">receita ponderada em pipeline</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Handshake size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Alertas Inteligentes */}
      {alerts.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Alertas</h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  alert.type === "danger"
                    ? "bg-destructive/5 border-destructive/20"
                    : alert.type === "warning"
                    ? "bg-warning/5 border-warning/20"
                    : "bg-primary/5 border-primary/20"
                }`}
              >
                {alertIcon(alert.type)}
                <div className="text-sm">
                  <p className="font-medium text-foreground">{alert.title}</p>
                  <p className="text-muted-foreground text-xs">{alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {noData && (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
          Nenhum lançamento encontrado. Cadastre contratos ou lançamentos no Fluxo de Caixa para ver dados aqui.
        </div>
      )}

      {/* SEÇÃO 3 — ANÁLISE FINANCEIRA (2 colunas: 70/30) */}
      <section className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Receita vs Despesas — Coluna principal (70%) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-xl p-6">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-foreground">Receita vs Despesas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Acompanhamento financeiro dos últimos 6 meses</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(v) => v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="receita"
                name="Receita"
                stroke="hsl(var(--primary))"
                fill="url(#gradReceita)"
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="despesas"
                name="Despesas"
                stroke="hsl(var(--destructive))"
                fill="url(#gradDespesas)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Despesas por Categoria — Coluna lateral (30%) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <PieChartIcon size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Despesas por Categoria</h3>
          </div>
          {expenseByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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
              <div className="space-y-2 mt-3">
                {expenseByCategory.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.fill }} />
                      <span className="text-muted-foreground truncate">{cat.name}</span>
                    </div>
                    <span className="font-medium text-foreground ml-2">{formatCurrency(cat.value)}</span>
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
      </section>

      {/* SEÇÃO 4 — EVOLUÇÃO */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Evolução da Receita</h3>
          <span className="text-xs text-muted-foreground ml-auto">Tendência nos últimos 6 meses</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="receitaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="receita"
              name="Receita"
              stroke="hsl(var(--success))"
              fill="url(#receitaGradient)"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
