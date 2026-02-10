import { useState, useMemo } from "react";
import { format, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { usePlanningScenarios } from "@/hooks/usePlanningScenarios";
import { useScenarioOverrides, ScenarioOverride } from "@/hooks/useScenarioOverrides";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useContracts } from "@/hooks/useContracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Settings2, Trash2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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
  const { contracts } = useContracts();
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();
  const [activeTypes, setActiveTypes] = useState<string[]>(["base"]);
  const [showCreate, setShowCreate] = useState(false);
  const [showOverrides, setShowOverrides] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "custom" as string,
    variacao_receita: 0,
    variacao_custos: 0,
    atraso_recebimento_dias: 0,
    description: "",
  });

  // Get the selected scenario for overrides
  const selectedScenario = scenarios.find(s => s.id === showOverrides);
  const { overrides, create: createOverride, remove: removeOverride } = useScenarioOverrides(showOverrides ?? undefined);

  const [overrideForm, setOverrideForm] = useState({
    account_id: "" as string,
    cost_center_id: "" as string,
    override_type: "percentual",
    valor: 0,
    notes: "",
  });

  const analyticalAccounts = useMemo(
    () => accounts.filter(a => !a.is_synthetic && a.active),
    [accounts]
  );

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const ccMap = useMemo(() => new Map(costCenters.map(c => [c.id, c])), [costCenters]);

  // Monthly base data — hybrid: cashflow history + contract projections
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

  // Build override maps per scenario for efficient lookup
  const overridesByScenario = useMemo(() => {
    const map = new Map<string, ScenarioOverride[]>();
    // We only have overrides for the currently viewed scenario
    if (showOverrides && overrides.length > 0) {
      map.set(showOverrides, overrides);
    }
    return map;
  }, [showOverrides, overrides]);

  // Apply scenario variations with overrides support
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

  const handleAddOverride = async () => {
    if (!showOverrides) return;
    await createOverride.mutateAsync({
      scenario_id: showOverrides,
      account_id: overrideForm.account_id || null,
      cost_center_id: overrideForm.cost_center_id || null,
      override_type: overrideForm.override_type,
      valor: overrideForm.valor,
      notes: overrideForm.notes || null,
    });
    setOverrideForm({ account_id: "", cost_center_id: "", override_type: "percentual", valor: 0, notes: "" });
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

      {/* Scenario parameters + override button */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {scenarios
          .filter((s) => activeTypes.includes(s.type))
          .map((s) => (
            <Card key={s.id} className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium capitalize">{s.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowOverrides(s.id)} title="Overrides por conta">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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

      {/* Projection source info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="h-3.5 w-3.5" />
        <span>Projeções baseadas em fluxo de caixa real + contratos ativos recorrentes (modo híbrido)</span>
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

      {/* Overrides Dialog */}
      <Dialog open={!!showOverrides} onOpenChange={() => setShowOverrides(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Overrides — {selectedScenario?.name ?? "Cenário"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Ajustes finos por conta ou centro de custo. Overrides são aplicados sobre as variações globais do cenário.
          </p>

          {/* Existing overrides */}
          {overrides.length > 0 && (
            <div className="glass-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Centro Custo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{accountMap.get(o.account_id ?? "")?.name ?? "Todas"}</TableCell>
                      <TableCell className="text-sm">{ccMap.get(o.cost_center_id ?? "")?.name ?? "Todos"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{o.override_type === "percentual" ? "%" : "R$"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {o.override_type === "percentual" ? `${o.valor > 0 ? "+" : ""}${o.valor}%` : fmt(o.valor)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOverride.mutate(o.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Add override form */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs font-medium text-foreground">Novo Override</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Conta (opcional)</Label>
                <Select value={overrideForm.account_id} onValueChange={(v) => setOverrideForm({ ...overrideForm, account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    {analyticalAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Centro Custo (opcional)</Label>
                <Select value={overrideForm.cost_center_id} onValueChange={(v) => setOverrideForm({ ...overrideForm, cost_center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    {costCenters.filter(c => c.active).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={overrideForm.override_type} onValueChange={(v) => setOverrideForm({ ...overrideForm, override_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="absoluto">Absoluto (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <Input type="number" value={overrideForm.valor} onChange={(e) => setOverrideForm({ ...overrideForm, valor: Number(e.target.value) })} />
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={handleAddOverride} disabled={createOverride.isPending} className="w-full">
                  {createOverride.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
