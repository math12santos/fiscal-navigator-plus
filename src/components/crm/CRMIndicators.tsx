import { CRMIntelligenceData } from "@/hooks/useCRMIntelligence";
import { KPICard } from "@/components/KPICard";
import { DollarSign, Target, Clock, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
} from "recharts";

interface Props {
  data: CRMIntelligenceData;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const funnelColors = ["#6366f1", "#8b5cf6", "#f59e0b", "#f97316", "#22c55e"];

export function CRMIndicators({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Pipeline Total"
          value={formatCurrency(data.totalPipelineValue)}
          change={0}
          subtitle="valor em aberto"
          icon={<DollarSign size={20} />}
        />
        <KPICard
          title="Receita Ponderada"
          value={formatCurrency(data.weightedPipelineValue)}
          change={0}
          subtitle="valor × probabilidade"
          icon={<Target size={20} />}
        />
        <KPICard
          title="Conversão Geral"
          value={`${data.overallConversion.toFixed(1)}%`}
          change={0}
          subtitle="ganhas / fechadas"
          icon={<TrendingUp size={20} />}
        />
        <KPICard
          title="Ciclo Médio"
          value={`${data.avgSalesCycleDays} dias`}
          change={0}
          subtitle="criação → fechamento"
          icon={<Clock size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel / Stage conversion */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Funil de Conversão</h3>
          {data.conversionByStage.length > 0 ? (
            <div className="space-y-3">
              {data.conversionByStage.map((stage, i) => {
                const maxCount = Math.max(...data.conversionByStage.map((s) => s.count), 1);
                const width = Math.max((stage.count / maxCount) * 100, 10);
                return (
                  <div key={stage.stageName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground font-medium">{stage.stageName}</span>
                      <span className="text-muted-foreground">{stage.count} • {formatCurrency(stage.value)}</span>
                    </div>
                    <div className="h-6 bg-muted/30 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${width}%`, backgroundColor: funnelColors[i % funnelColors.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">Sem dados de conversão</div>
          )}
        </div>

        {/* Forecast by month */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Forecast Mensal</h3>
          {data.forecastByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.forecastByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" name="Forecast" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">Sem forecast disponível</div>
          )}
        </div>
      </div>

      {/* Client stats */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição de Clientes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {Object.entries(data.clientsByStatus).map(([status, count]) => (
            <div key={status} className="text-center">
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground capitalize">{status.replace("_", " ")}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-8 mt-4 pt-4 border-t border-border/50">
          <div>
            <p className="text-xs text-muted-foreground">MRR Médio</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(data.avgMRR)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Health Score Médio</p>
            <p className="text-lg font-semibold text-foreground">{data.avgHealthScore}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
