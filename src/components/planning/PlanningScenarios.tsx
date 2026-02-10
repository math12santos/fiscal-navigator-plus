import { useState, useMemo } from "react";
import { format, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { usePlanningScenarios } from "@/hooks/usePlanningScenarios";
import { useCashFlow } from "@/hooks/useCashFlow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const COLORS: Record<string, string> = {
  base: "hsl(var(--primary))",
  otimista: "hsl(var(--success))",
  conservador: "hsl(var(--warning))",
  stress: "hsl(var(--destructive))",
  custom: "hsl(262, 60%, 55%)",
};

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function PlanningScenarios({ startDate, endDate }: Props) {
  const { scenarios, isLoading, create, remove, seedDefaults } = usePlanningScenarios();
  const { entries } = useCashFlow(startDate, endDate);
  const [activeTypes, setActiveTypes] = useState<string[]>(["base"]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "custom" as string,
    variacao_receita: 0,
    variacao_custos: 0,
    atraso_recebimento_dias: 0,
    description: "",
  });

  // Monthly base data from cashflow
  const monthlyBase = useMemo(() => {
    const months: Record<string, { entradas: number; saidas: number }> = {};
    let cursor = startOfMonth(startDate);
    while (cursor <= endDate) {
      months[format(cursor, "yyyy-MM")] = { entradas: 0, saidas: 0 };
      cursor = addMonths(cursor, 1);
    }
    for (const e of entries) {
      const key = e.data_prevista.slice(0, 7);
      if (months[key]) {
        const val = Number(e.valor_realizado ?? e.valor_previsto);
        if (e.tipo === "entrada") months[key].entradas += val;
        else months[key].saidas += val;
      }
    }
    return Object.entries(months).map(([key, val]) => ({
      month: key,
      label: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
      entradas: val.entradas,
      saidas: val.saidas,
    }));
  }, [entries, startDate, endDate]);

  // Apply scenario variations
  const chartData = useMemo(() => {
    return monthlyBase.map((m) => {
      const row: Record<string, any> = { mes: m.label };
      for (const s of scenarios) {
        const receitaFactor = 1 + (s.variacao_receita / 100);
        const custoFactor = 1 + (s.variacao_custos / 100);
        const saldo = (m.entradas * receitaFactor) - (m.saidas * custoFactor);
        row[s.type] = Math.round(saldo);
      }
      return row;
    });
  }, [monthlyBase, scenarios]);

  const toggleScenario = (type: string) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleCreate = async () => {
    await create.mutateAsync({
      name: form.name,
      type: form.type,
      description: form.description || null,
      is_active: true,
      variacao_receita: form.variacao_receita,
      variacao_custos: form.variacao_custos,
      atraso_recebimento_dias: form.atraso_recebimento_dias,
    });
    setShowCreate(false);
    setForm({ name: "", type: "custom", variacao_receita: 0, variacao_custos: 0, atraso_recebimento_dias: 0, description: "" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground text-sm">Nenhum cenário configurado ainda.</p>
        <Button onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
          {seedDefaults.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Criar cenários padrão (Base, Otimista, Conservador, Stress)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scenario selector */}
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => toggleScenario(s.type)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all",
              activeTypes.includes(s.type)
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {s.name}
            <span className="ml-1.5 text-[10px] opacity-70">
              {s.variacao_receita > 0 ? "+" : ""}{s.variacao_receita}% rec
            </span>
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Cenário
        </Button>
      </div>

      {/* Scenario parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {scenarios
          .filter((s) => activeTypes.includes(s.type))
          .map((s) => (
            <Card key={s.id} className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">{s.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>Receita: <span className={cn("font-medium", s.variacao_receita >= 0 ? "text-success" : "text-destructive")}>{s.variacao_receita > 0 ? "+" : ""}{s.variacao_receita}%</span></p>
                <p>Custos: <span className={cn("font-medium", s.variacao_custos <= 0 ? "text-success" : "text-destructive")}>{s.variacao_custos > 0 ? "+" : ""}{s.variacao_custos}%</span></p>
                <p>Atraso recebimento: <span className="font-medium text-foreground">{s.atraso_recebimento_dias}d</span></p>
                {s.description && <p className="mt-1 italic">{s.description}</p>}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Saldo Líquido por Cenário</h3>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: number) => fmt(v)}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {scenarios.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.type}
                name={s.name}
                stroke={COLORS[s.type] || COLORS.custom}
                strokeWidth={activeTypes.includes(s.type) ? 3 : 1}
                strokeDasharray={activeTypes.includes(s.type) ? "0" : "5 5"}
                dot={false}
                hide={!activeTypes.includes(s.type)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Create Scenario Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cenário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Expansão 2026" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="otimista">Otimista</SelectItem>
                  <SelectItem value="conservador">Conservador</SelectItem>
                  <SelectItem value="stress">Stress</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Variação Receita (%)</Label>
                <Input type="number" value={form.variacao_receita} onChange={(e) => setForm({ ...form, variacao_receita: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Variação Custos (%)</Label>
                <Input type="number" value={form.variacao_custos} onChange={(e) => setForm({ ...form, variacao_custos: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Atraso Receb. (dias)</Label>
                <Input type="number" value={form.atraso_recebimento_dias} onChange={(e) => setForm({ ...form, atraso_recebimento_dias: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.name || create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
