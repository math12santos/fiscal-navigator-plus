import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  Activity,
  Clock,
  PiggyBank,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useSaasKpis } from "@/hooks/useSaasKpis";
import { useNavigate } from "react-router-dom";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLShort = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return fmtBRL(v);
};
const fmtMonthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
};

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  trend?: { value: number; positive: boolean };
  tone?: "default" | "success" | "warning" | "danger";
}

function KpiCard({ icon: Icon, label, value, hint, trend, tone = "default" }: KpiCardProps) {
  const toneClass =
    tone === "success"
      ? "text-emerald-500"
      : tone === "warning"
      ? "text-amber-500"
      : tone === "danger"
      ? "text-destructive"
      : "text-primary";
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon size={16} className={toneClass} />
        </div>
        <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
        <div className="flex items-center justify-between">
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : <span />}
          {trend && (
            <span
              className={`text-xs font-medium flex items-center gap-0.5 ${
                trend.positive ? "text-emerald-500" : "text-destructive"
              }`}
            >
              {trend.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend.value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SaasOverviewPanel() {
  const { data, isLoading } = useSaasKpis();
  const navigate = useNavigate();

  const churnRate = useMemo(() => {
    if (!data) return 0;
    const total = data.counts.active + data.counts.canceled + data.counts.past_due;
    if (total === 0) return 0;
    return (data.counts.canceled / total) * 100;
  }, [data]);

  const netGrowthLastMonth = useMemo(() => {
    if (!data?.growth_12m?.length) return 0;
    return data.growth_12m[data.growth_12m.length - 1]?.net ?? 0;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const growthChartData = data.growth_12m.map((g) => ({
    month: fmtMonthLabel(g.month),
    Novas: g.new,
    Canceladas: -g.canceled,
    Líquido: g.net,
  }));
  const revenueChartData = data.revenue_series_12m.map((r) => ({
    month: fmtMonthLabel(r.month),
    Faturado: Number(r.invoiced),
    Recebido: Number(r.paid),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            Visão Executiva do SaaS
          </h2>
          <p className="text-xs text-muted-foreground">
            KPIs consolidados de receita, crescimento e saúde da base.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/backoffice/faturamento")}>
          Gerenciar faturamento
        </Button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={DollarSign}
          label="MRR"
          value={fmtBRLShort(data.mrr)}
          hint={`ARR: ${fmtBRLShort(data.arr)}`}
          tone="success"
        />
        <KpiCard
          icon={PiggyBank}
          label="ARPU"
          value={fmtBRL(data.arpu)}
          hint={`${data.counts.active} clientes ativos`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Crescimento líquido (mês)"
          value={`${netGrowthLastMonth >= 0 ? "+" : ""}${netGrowthLastMonth}`}
          hint="Novas − canceladas"
          tone={netGrowthLastMonth >= 0 ? "success" : "danger"}
          trend={{ value: Math.abs(netGrowthLastMonth), positive: netGrowthLastMonth >= 0 }}
        />
        <KpiCard
          icon={Activity}
          label="Churn rate"
          value={`${churnRate.toFixed(1)}%`}
          hint={`${data.counts.canceled} cancelamentos`}
          tone={churnRate > 5 ? "danger" : churnRate > 2 ? "warning" : "success"}
        />
        <KpiCard
          icon={Users}
          label="Empresas ativas"
          value={String(data.counts.active)}
          hint={`${data.counts.trialing} em trial`}
        />
        <KpiCard
          icon={Clock}
          label="Em trial"
          value={String(data.counts.trialing)}
          hint="Conversão pendente"
          tone="warning"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Inadimplentes"
          value={String(data.counts.past_due)}
          hint={fmtBRLShort(data.overdue_amount) + " em atraso"}
          tone={data.counts.past_due > 0 ? "danger" : "default"}
        />
        <KpiCard
          icon={DollarSign}
          label="Receita 12m"
          value={fmtBRLShort(data.revenue_12m)}
          hint={`A receber: ${fmtBRLShort(data.open_amount)}`}
          tone="success"
        />
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Crescimento da base (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Novas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Canceladas" fill="hsl(var(--destructive))" radius={[0, 0, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receita faturada vs recebida (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => fmtBRLShort(Number(v))}
                  />
                  <Tooltip
                    formatter={(v: number) => fmtBRL(Number(v))}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Faturado" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="Recebido"
                    stroke="hsl(142, 70%, 45%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listas e mix */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mix de planos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.plan_breakdown ?? []).map((p) => {
              const totalSubs = (data.plan_breakdown ?? []).reduce((s, x) => s + Number(x.subscribers), 0) || 1;
              const pct = (Number(p.subscribers) / totalSubs) * 100;
              return (
                <div key={p.code} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {p.subscribers} • {fmtBRLShort(Number(p.mrr))}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {(!data.plan_breakdown || data.plan_breakdown.length === 0) && (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum plano configurado.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top clientes (receita 12m)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.top_revenue ?? []).map((c, i) => (
              <button
                key={c.id}
                className="w-full flex items-center justify-between text-sm hover:bg-secondary/50 px-2 py-1.5 rounded transition-colors text-left"
                onClick={() => navigate(`/backoffice/empresa/${c.id}`)}
              >
                <span className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {i + 1}
                  </Badge>
                  <span className="truncate text-foreground">{c.name}</span>
                </span>
                <span className="text-emerald-500 font-medium tabular-nums whitespace-nowrap">
                  {fmtBRLShort(Number(c.revenue))}
                </span>
              </button>
            ))}
            {(!data.top_revenue || data.top_revenue.length === 0) && (
              <p className="text-xs text-muted-foreground py-6 text-center">Sem faturas pagas ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle size={14} className="text-destructive" />
              Em risco (inadimplência)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.top_overdue ?? []).map((c) => (
              <button
                key={c.id}
                className="w-full flex items-center justify-between text-sm hover:bg-secondary/50 px-2 py-1.5 rounded transition-colors text-left"
                onClick={() => navigate(`/backoffice/empresa/${c.id}`)}
              >
                <div className="flex flex-col items-start truncate">
                  <span className="text-foreground truncate">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {c.open_invoices} fatura(s) • desde {new Date(c.oldest_due).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <span className="text-destructive font-medium tabular-nums whitespace-nowrap">
                  {fmtBRLShort(Number(c.overdue_amount))}
                </span>
              </button>
            ))}
            {(!data.top_overdue || data.top_overdue.length === 0) && (
              <p className="text-xs text-muted-foreground py-6 text-center">
                🎉 Nenhuma inadimplência detectada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
