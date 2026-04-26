// Gráficos Recharts inline para o módulo de Gestão de Desempenho.
// Componentes puros — recebem dados já filtrados/agregados pelo container.

import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  RadialBarChart, RadialBar,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBSCIndicators, useBSCHistory } from "@/hooks/useBSC";

// Paleta semântica via variáveis CSS do design system
const COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(142 71% 45%)",
  warning: "hsl(38 92% 50%)",
  danger: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
  accent: "hsl(var(--accent-foreground))",
  perspectiva: {
    financeira: "hsl(217 91% 60%)",
    clientes: "hsl(142 71% 45%)",
    processos: "hsl(38 92% 50%)",
    aprendizado: "hsl(280 75% 60%)",
  },
  status: {
    nao_iniciado: "hsl(var(--muted-foreground))",
    em_andamento: "hsl(217 91% 60%)",
    em_atraso: "hsl(var(--destructive))",
    concluido: "hsl(142 71% 45%)",
    cancelado: "hsl(var(--muted-foreground))",
  },
  humor: {
    muito_bom: "hsl(142 71% 45%)",
    bom: "hsl(160 60% 50%)",
    neutro: "hsl(38 92% 50%)",
    ruim: "hsl(20 90% 55%)",
    critico: "hsl(var(--destructive))",
  },
};

const HUMOR_SCORE: Record<string, number> = {
  muito_bom: 5, bom: 4, neutro: 3, ruim: 2, critico: 1,
};

// ============================== PDI ==============================
export function PDICharts({ pdis, employeeMap }: { pdis: any[]; employeeMap: Map<string, any> }) {
  // 1) Status donut
  const statusData = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of pdis) acc[p.status] = (acc[p.status] || 0) + 1;
    return Object.entries(acc).map(([k, v]) => ({
      name: k.replace("_", " "), value: v, key: k,
    }));
  }, [pdis]);

  // 2) Evolução média por colaborador (top 8)
  const byEmployee = useMemo(() => {
    const map = new Map<string, { total: number; count: number; sum: number; emAtraso: number }>();
    for (const p of pdis) {
      const m = map.get(p.employee_id) || { total: 0, count: 0, sum: 0, emAtraso: 0 };
      m.count += 1;
      m.sum += Number(p.percentual_evolucao || 0);
      if (p.status === "em_atraso") m.emAtraso += 1;
      map.set(p.employee_id, m);
    }
    return Array.from(map.entries())
      .map(([empId, m]) => ({
        name: (employeeMap.get(empId)?.name || "—").split(" ").slice(0, 2).join(" "),
        evolucao: Math.round(m.sum / m.count),
        atraso: m.emAtraso,
      }))
      .sort((a, b) => b.evolucao - a.evolucao)
      .slice(0, 8);
  }, [pdis, employeeMap]);

  // 3) Tendência mensal de evolução média (últimos 6 meses pelo ultima_atualizacao_em)
  const trend = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const p of pdis) {
      const ts = p.ultima_atualizacao_em || p.data_inicio;
      if (!ts) continue;
      const key = format(startOfMonth(parseISO(ts)), "yyyy-MM");
      const b = buckets.get(key) || { sum: 0, count: 0 };
      b.sum += Number(p.percentual_evolucao || 0);
      b.count += 1;
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, v]) => ({
        mes: format(parseISO(`${k}-01`), "MMM/yy", { locale: ptBR }),
        media: Math.round(v.sum / v.count),
      }));
  }, [pdis]);

  if (pdis.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
      <ChartCard title="Distribuição por status">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {statusData.map((d, i) => (
                <Cell key={i} fill={(COLORS.status as any)[d.key] || COLORS.muted} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Evolução média por colaborador (top 8)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byEmployee} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" domain={[0, 100]} fontSize={10} stroke={COLORS.muted} />
            <YAxis type="category" dataKey="name" fontSize={10} width={80} stroke={COLORS.muted} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Bar dataKey="evolucao" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tendência de evolução média (6 meses)">
        {trend.length === 0 ? (
          <EmptyChart text="Sem dados temporais ainda" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" fontSize={10} stroke={COLORS.muted} />
              <YAxis domain={[0, 100]} fontSize={10} stroke={COLORS.muted} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="media" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// ============================== One-on-One ==============================
export function OneOnOneCharts({ list, employeeMap }: { list: any[]; employeeMap: Map<string, any> }) {
  // Agendadas vs realizadas por mês (últimos 6)
  const monthly = useMemo(() => {
    const buckets = new Map<string, { realizada: number; agendada: number; cancelada: number }>();
    for (const o of list) {
      const key = format(startOfMonth(parseISO(o.data_reuniao)), "yyyy-MM");
      const b = buckets.get(key) || { realizada: 0, agendada: 0, cancelada: 0 };
      if (o.status === "realizada") b.realizada += 1;
      else if (o.status === "cancelada") b.cancelada += 1;
      else b.agendada += 1;
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, v]) => ({
        mes: format(parseISO(`${k}-01`), "MMM/yy", { locale: ptBR }),
        ...v,
      }));
  }, [list]);

  // Tendência de humor por colaborador (média móvel)
  const humorTrend = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const o of list) {
      if (!o.humor) continue;
      const key = format(startOfMonth(parseISO(o.data_reuniao)), "yyyy-MM");
      const b = buckets.get(key) || { sum: 0, count: 0 };
      b.sum += HUMOR_SCORE[o.humor] || 3;
      b.count += 1;
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, v]) => ({
        mes: format(parseISO(`${k}-01`), "MMM/yy", { locale: ptBR }),
        humor: Math.round((v.sum / v.count) * 10) / 10,
      }));
  }, [list]);

  // Top colaboradores por nº de 1:1 realizadas
  const topRealizadas = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of list) {
      if (o.status === "realizada") map.set(o.employee_id, (map.get(o.employee_id) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([empId, count]) => ({
        name: (employeeMap.get(empId)?.name || "—").split(" ").slice(0, 2).join(" "),
        realizadas: count,
      }))
      .sort((a, b) => b.realizadas - a.realizadas)
      .slice(0, 6);
  }, [list, employeeMap]);

  if (list.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
      <ChartCard title="Reuniões por mês">
        {monthly.length === 0 ? <EmptyChart text="Sem histórico ainda" /> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" fontSize={10} stroke={COLORS.muted} />
              <YAxis fontSize={10} stroke={COLORS.muted} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="realizada" stackId="a" fill={COLORS.success} name="Realizadas" />
              <Bar dataKey="agendada" stackId="a" fill={COLORS.warning} name="Agendadas" />
              <Bar dataKey="cancelada" stackId="a" fill={COLORS.danger} name="Canceladas" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Humor médio do time (1=crítico · 5=ótimo)">
        {humorTrend.length === 0 ? <EmptyChart text="Registre o humor nas reuniões para ver a tendência" /> : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={humorTrend}>
              <defs>
                <linearGradient id="humorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" fontSize={10} stroke={COLORS.muted} />
              <YAxis domain={[1, 5]} fontSize={10} stroke={COLORS.muted} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="humor" stroke={COLORS.primary} strokeWidth={2} fill="url(#humorGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Top colaboradores — 1:1 realizadas">
        {topRealizadas.length === 0 ? <EmptyChart text="Sem reuniões realizadas" /> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topRealizadas} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={10} stroke={COLORS.muted} allowDecimals={false} />
              <YAxis type="category" dataKey="name" fontSize={10} width={80} stroke={COLORS.muted} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="realizadas" fill={COLORS.success} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// ============================== BSC ==============================
export function BSCCharts({ list, employeeMap, departments }: {
  list: any[]; employeeMap: Map<string, any>; departments: any[];
}) {
  const [selected, setSelected] = useState<string>(list[0]?.id || "");
  const bsc = list.find((b) => b.id === selected);
  const { data: indicators = [] } = useBSCIndicators(selected || undefined);
  const { data: history = [] } = useBSCHistory(selected || undefined);

  // Resultado geral por scorecard (top 8)
  const scorecardOverview = useMemo(() => {
    return list
      .slice()
      .sort((a, b) => Number(b.resultado_geral) - Number(a.resultado_geral))
      .slice(0, 8)
      .map((b) => ({
        name: b.nome.length > 18 ? b.nome.slice(0, 18) + "…" : b.nome,
        resultado: Math.round(Number(b.resultado_geral)),
      }));
  }, [list]);

  // Indicadores agrupados por perspectiva
  const byPerspective = useMemo(() => {
    const acc: Record<string, { sum: number; count: number; pesoSum: number; pesoPond: number }> = {};
    for (const i of indicators) {
      const k = i.perspectiva;
      const a = acc[k] || { sum: 0, count: 0, pesoSum: 0, pesoPond: 0 };
      a.sum += Number(i.percentual_atingimento || 0);
      a.count += 1;
      a.pesoSum += Number(i.peso || 0);
      a.pesoPond += Number(i.nota_ponderada || 0);
      acc[k] = a;
    }
    return Object.entries(acc).map(([k, v]) => ({
      name: k,
      media: v.count > 0 ? Math.round(v.sum / v.count) : 0,
      ponderada: v.pesoSum > 0 ? Math.round(v.pesoPond / v.pesoSum) : 0,
    }));
  }, [indicators]);

  // Histórico mensal agregado
  const historyData = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const h of history) {
      const b = buckets.get(h.periodo_mes) || { sum: 0, count: 0 };
      b.sum += Number(h.percentual || 0);
      b.count += 1;
      buckets.set(h.periodo_mes, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        mes: format(parseISO(k), "MMM/yy", { locale: ptBR }),
        percentual: Math.round(v.sum / v.count),
      }));
  }, [history]);

  // Meta vs Realizado por indicador
  const metaRealizado = useMemo(() => {
    return indicators.slice(0, 8).map((i) => ({
      name: i.nome.length > 16 ? i.nome.slice(0, 16) + "…" : i.nome,
      meta: Number(i.meta || 0),
      realizado: Number(i.realizado || 0),
      perspectiva: i.perspectiva,
    }));
  }, [indicators]);

  if (list.length === 0) return null;

  const vinculo = bsc
    ? bsc.tipo === "individual"
      ? employeeMap.get(bsc.employee_id)?.name || "—"
      : bsc.tipo === "departamento"
        ? departments.find((d: any) => d.id === bsc.department_id)?.name || "—"
        : "Toda a empresa"
    : "—";

  return (
    <div className="space-y-3 mb-4">
      <ChartCard title="Resultado geral — top 8 scorecards">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={scorecardOverview}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" fontSize={10} stroke={COLORS.muted} angle={-15} textAnchor="end" height={50} />
            <YAxis domain={[0, 120]} fontSize={10} stroke={COLORS.muted} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Bar dataKey="resultado" fill={COLORS.primary} radius={[4, 4, 0, 0]}>
              {scorecardOverview.map((d, i) => {
                const tone = d.resultado >= 100 ? COLORS.success : d.resultado >= 70 ? COLORS.warning : COLORS.danger;
                return <Cell key={i} fill={tone} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Drill-down: scorecard selecionado */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs text-muted-foreground">Detalhar scorecard:</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-72 h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {list.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bsc && (
              <span className="text-xs text-muted-foreground">
                {vinculo} · {bsc.periodo_inicio} → {bsc.periodo_fim} · resultado{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {Math.round(Number(bsc.resultado_geral))}%
                </span>
              </span>
            )}
          </div>

          {selected && indicators.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Este scorecard ainda não tem indicadores cadastrados.
            </p>
          )}

          {selected && indicators.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <ChartCard title="Atingimento por perspectiva">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart innerRadius="30%" outerRadius="100%" data={byPerspective} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="ponderada" cornerRadius={6} background>
                      {byPerspective.map((d, i) => (
                        <Cell key={i} fill={(COLORS.perspectiva as any)[d.name] || COLORS.primary} />
                      ))}
                    </RadialBar>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Meta × Realizado por indicador">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={metaRealizado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={9} stroke={COLORS.muted} angle={-20} textAnchor="end" height={50} />
                    <YAxis fontSize={10} stroke={COLORS.muted} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="meta" fill={COLORS.muted} name="Meta" />
                    <Bar dataKey="realizado" fill={COLORS.primary} name="Realizado" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Histórico mensal de % atingimento">
                {historyData.length < 2 ? (
                  <EmptyChart text="Histórico será gerado conforme os indicadores forem atualizados" />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" fontSize={10} stroke={COLORS.muted} />
                      <YAxis domain={[0, 120]} fontSize={10} stroke={COLORS.muted} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Line type="monotone" dataKey="percentual" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================== Helpers ==============================
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground text-center px-4">
      {text}
    </div>
  );
}
