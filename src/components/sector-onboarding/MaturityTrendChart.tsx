// Gráfico de tendência da maturidade ao longo do tempo (mensal).

import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp } from "lucide-react";
import { useMaturityHistory } from "@/hooks/useMaturityHistory";
import { SectorKey } from "@/lib/sectorMaturity/types";

interface Props {
  sector: SectorKey;
  organizationId?: string;
}

const RANGE_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
];

export function MaturityTrendChart({ sector, organizationId }: Props) {
  const [range, setRange] = useState("6");
  const months = parseInt(range, 10);
  const { data: history = [], isLoading } = useMaturityHistory(sector, organizationId, months);

  const chartData = useMemo(() => {
    return history.map((h) => ({
      month: format(parseISO(h.period_month), "MMM/yy", { locale: ptBR }),
      Score: Number(h.score),
      Completude: Number(h.completeness_score),
      Atualização: Number(h.freshness_score),
      Rotinas: Number(h.routines_score),
    }));
  }, [history]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp size={16} className="text-primary" />
          Evolução do score (mensal)
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Ainda não há histórico para este período. Os snapshots são gerados ao final de cada mês
              (ou ao acessar o setor pela primeira vez no mês).
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Completude" stroke="#2563eb" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="Atualização" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="Rotinas" stroke="#16a34a" strokeWidth={1.5} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
