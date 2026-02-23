import { useState, useMemo } from "react";
import { format, addMonths, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useHRPlanning, useMutateHRPlanning, useEmployees, usePositions, useDPConfig } from "@/hooks/useDP";
import { usePlanningScenarios } from "@/hooks/usePlanningScenarios";
import { useCostCenters } from "@/hooks/useCostCenters";
import { calcEncargosPatronais } from "@/hooks/useDP";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, UserPlus, UserMinus, TrendingUp, Users, DollarSign } from "lucide-react";
import { KPICard } from "@/components/KPICard";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function PlanningHR({ startDate, endDate }: Props) {
  const { data: hrItems = [], isLoading } = useHRPlanning();
  const { create, remove } = useMutateHRPlanning();
  const { data: employees = [] } = useEmployees();
  const { data: positions = [] } = usePositions();
  const { data: dpConfig } = useDPConfig();
  const { scenarios } = usePlanningScenarios();
  const { costCenters } = useCostCenters();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    type: "contratacao",
    position_id: "",
    cost_center_id: "",
    planned_date: format(new Date(), "yyyy-MM-dd"),
    quantity: 1,
    salary_estimated: 0,
    scenario_name: "Base",
    notes: "",
  });

  const activeEmployees = useMemo(() => employees.filter((e: any) => e.status === "ativo"), [employees]);

  // Calculate total cost with employer charges
  const calcTotalCost = (salary: number, qty: number) => {
    const encargos = calcEncargosPatronais(salary, dpConfig);
    return (salary + encargos.total) * qty;
  };

  // Monthly impact projection
  const monthlyProjection = useMemo(() => {
    const months: Record<string, { contratacoes: number; desligamentos: number; impacto: number }> = {};
    let cursor = startOfMonth(startDate);
    while (!isAfter(cursor, endDate)) {
      months[format(cursor, "yyyy-MM")] = { contratacoes: 0, desligamentos: 0, impacto: 0 };
      cursor = addMonths(cursor, 1);
    }

    for (const item of hrItems) {
      const key = item.planned_date.slice(0, 7);
      if (!months[key]) continue;
      const totalCost = item.total_cost_estimated ?? calcTotalCost(item.salary_estimated ?? 0, item.quantity ?? 1);
      if (item.type === "contratacao") {
        months[key].contratacoes += item.quantity ?? 1;
        // Accumulate cost for remaining months
        let cur = startOfMonth(new Date(item.planned_date));
        while (!isAfter(cur, endDate)) {
          const k = format(cur, "yyyy-MM");
          if (months[k]) months[k].impacto += totalCost;
          cur = addMonths(cur, 1);
        }
      } else {
        months[key].desligamentos += item.quantity ?? 1;
        let cur = startOfMonth(new Date(item.planned_date));
        while (!isAfter(cur, endDate)) {
          const k = format(cur, "yyyy-MM");
          if (months[k]) months[k].impacto -= totalCost;
          cur = addMonths(cur, 1);
        }
      }
    }

    return Object.entries(months).map(([key, val]) => ({
      mes: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
      contratacoes: val.contratacoes,
      desligamentos: val.desligamentos,
      impacto: Math.round(val.impacto),
    }));
  }, [hrItems, startDate, endDate, dpConfig]);

  // KPI totals
  const totalNewHires = hrItems.filter(i => i.type === "contratacao").reduce((s, i) => s + (i.quantity ?? 1), 0);
  const totalTerminations = hrItems.filter(i => i.type === "desligamento").reduce((s, i) => s + (i.quantity ?? 1), 0);
  const totalMonthlyImpact = hrItems.reduce((s, i) => {
    const cost = i.total_cost_estimated ?? calcTotalCost(i.salary_estimated ?? 0, i.quantity ?? 1);
    return s + (i.type === "contratacao" ? cost : -cost);
  }, 0);

  const handleCreate = async () => {
    const salary = form.salary_estimated;
    const qty = form.quantity;
    const totalCost = calcTotalCost(salary, qty);
    await create.mutateAsync({
      type: form.type,
      position_id: form.position_id || null,
      cost_center_id: form.cost_center_id || null,
      planned_date: form.planned_date,
      quantity: qty,
      salary_estimated: salary,
      total_cost_estimated: totalCost,
      scenario_name: form.scenario_name,
      notes: form.notes || null,
    });
    setShowCreate(false);
  };

  const posMap = useMemo(() => new Map(positions.map((p: any) => [p.id, p])), [positions]);
  const ccMap = useMemo(() => new Map(costCenters.map((c: any) => [c.id, c])), [costCenters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Headcount Atual" value={String(activeEmployees.length)} icon={<Users size={20} />} />
        <KPICard title="Contratações Planejadas" value={String(totalNewHires)} icon={<UserPlus size={20} />} />
        <KPICard title="Desligamentos Planejados" value={String(totalTerminations)} icon={<UserMinus size={20} />} />
        <KPICard title="Impacto Mensal" value={fmt(totalMonthlyImpact)} icon={<DollarSign size={20} />} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Itens de Planejamento RH</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Item
        </Button>
      </div>

      {/* Items Table */}
      {hrItems.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum item de planejamento RH criado. Adicione contratações ou desligamentos planejados.
          </CardContent>
        </Card>
      ) : (
        <div className="glass-card overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Data Prev.</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Salário Est.</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                <TableHead>Cenário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hrItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant={item.type === "contratacao" ? "default" : "destructive"} className="text-xs">
                      {item.type === "contratacao" ? "Contratação" : "Desligamento"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{posMap.get(item.position_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{ccMap.get(item.cost_center_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(item.planned_date), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(item.salary_estimated ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{fmt(item.total_cost_estimated ?? 0)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{item.scenario_name}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs capitalize">{item.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Monthly Impact Chart */}
      {monthlyProjection.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Impacto Mensal Projetado — Planejamento RH</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number, name: string) => [name === "impacto" ? fmt(v) : v, name === "impacto" ? "Impacto R$" : name === "contratacoes" ? "Contratações" : "Desligamentos"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="contratacoes" name="Contratações" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="desligamentos" name="Desligamentos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="impacto" name="Impacto R$" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Item de Planejamento RH</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contratacao">Contratação</SelectItem>
                    <SelectItem value="desligamento">Desligamento</SelectItem>
                    <SelectItem value="reajuste">Reajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cenário</Label>
                <Select value={form.scenario_name} onValueChange={(v) => setForm({ ...form, scenario_name: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scenarios.length > 0 ? scenarios.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    )) : (
                      <SelectItem value="Base">Base</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={form.position_id} onValueChange={(v) => setForm({ ...form, position_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Select value={form.cost_center_id} onValueChange={(v) => setForm({ ...form, cost_center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {costCenters.filter((c: any) => c.active).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Data Prevista</Label>
                <Input type="date" value={form.planned_date} onChange={(e) => setForm({ ...form, planned_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Salário Estimado</Label>
                <Input type="number" value={form.salary_estimated} onChange={(e) => setForm({ ...form, salary_estimated: Number(e.target.value) })} />
              </div>
            </div>
            {form.salary_estimated > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
                <p>Custo total estimado (salário + encargos): <span className="font-medium text-foreground">{fmt(calcTotalCost(form.salary_estimated, form.quantity))}</span></p>
                <p className="text-muted-foreground">Inclui INSS patronal, RAT, FGTS e terceiros conforme configuração DP</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
