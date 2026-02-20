import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import {
  useCommercialPlanning,
  useCommercialBudgetLines,
  useCommercialChannels,
  useCommercialScenarios,
  computeChannelProjections,
  type CommercialPlan,
  type CommercialChannel,
  type CommercialScenario,
} from "@/hooks/useCommercialPlanning";
import { useBudget } from "@/hooks/useBudget";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DebouncedInput } from "@/components/ui/debounced-input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, BarChart3, DollarSign, Percent, Clock, Target,
  Plus, Trash2, Sparkles, TrendingUp, Wallet, ArrowUpDown, Calculator,
  CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const TicketSimulator = lazy(() => import("@/components/planning/TicketSimulator"));

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function PlanningCommercial({ startDate, endDate }: Props) {
  const { plans, createPlan, updatePlan, deletePlan } = useCommercialPlanning();
  const { versions } = useBudget();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("Plano Comercial");
  const [newPlanMode, setNewPlanMode] = useState<"top_down" | "bottom_up">("top_down");
  const [newPlanPeriod, setNewPlanPeriod] = useState(12);
  const [newPlanBudget, setNewPlanBudget] = useState(0);
  const [showBudgetAlert, setShowBudgetAlert] = useState(false);
  const [fixedCostMode, setFixedCostMode] = useState<"nao_rateado" | "rateado">("nao_rateado");

  const plan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const { lines, createLine, updateLine, deleteLine } = useCommercialBudgetLines(selectedPlanId);
  const { channels, createChannel, updateChannel, deleteChannel, seedDefaults: seedChannels } = useCommercialChannels(selectedPlanId);
  const { scenarios, createScenario, seedDefaults: seedScenarios } = useCommercialScenarios(selectedPlanId);

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  // ─── Computed Totals ───
  const budgetTotals = useMemo(() => {
    const fixos = lines.filter((l) => l.category === "fixo").reduce((s, l) => s + Number(l.valor_total), 0);
    const variaveis = lines.filter((l) => l.category === "variavel").reduce((s, l) => s + Number(l.valor_total), 0);
    const feiras = lines.filter((l) => l.category === "feira").reduce((s, l) => s + Number(l.valor_total), 0);
    const midia = channels.filter((c) => c.channel_type !== "feira").reduce((s, c) => s + Number(c.orcamento_alocado), 0);
    const total = fixos + variaveis + feiras + midia;
    return { fixos, variaveis, feiras, midia, total };
  }, [lines, channels]);

  const projections = useMemo(() => {
    return channels.map((ch) => ({
      channel: ch,
      ...computeChannelProjections(ch, activeScenario, plan?.period_months ?? 12),
    }));
  }, [channels, activeScenario, plan]);

  const globalMetrics = useMemo(() => {
    const receita = projections.reduce((s, p) => s + p.receita, 0);
    const comissao = projections.reduce((s, p) => s + p.comissao, 0);
    const custoTotal = budgetTotals.total;
    const roi = custoTotal > 0 ? ((receita - custoTotal) / custoTotal) * 100 : 0;
    const period = plan?.period_months ?? 12;
    const burnMensal = custoTotal / period;
    const payback = burnMensal > 0 && receita > 0 ? custoTotal / (receita / period) : Infinity;
    const budget = Number(plan?.budget_approved ?? 0);
    const comprometido = budget > 0 ? (custoTotal / budget) * 100 : 0;
    const remanescente = budget - custoTotal;
    const runwayComercial = burnMensal > 0 ? budget / burnMensal : Infinity;
    const vendas = projections.reduce((s, p) => s + p.vendas, 0);
    const leads = projections.reduce((s, p) => s + p.leads, 0);

    return { receita, comissao, custoTotal, roi, payback, burnMensal, comprometido, remanescente, runwayComercial, vendas, leads };
  }, [projections, budgetTotals, plan]);

  // ─── Budget exceeded alert ───
  const budgetExceeded = plan && Number(plan.budget_approved) > 0 && budgetTotals.total > Number(plan.budget_approved);

  // ─── Scenario chart data ───
  const scenarioChartData = useMemo(() => {
    if (scenarios.length === 0) return [];
    return scenarios.filter((s) => s.is_active).map((sc) => {
      const proj = channels.map((ch) => computeChannelProjections(ch, sc, plan?.period_months ?? 12));
      const receita = proj.reduce((s, p) => s + p.receita, 0);
      const roi = budgetTotals.total > 0 ? ((receita - budgetTotals.total) / budgetTotals.total) * 100 : 0;
      return { name: sc.name, receita, roi };
    });
  }, [scenarios, channels, plan, budgetTotals]);

  // ─── Handlers ───
  const handleCreatePlan = async () => {
    const result = await createPlan.mutateAsync({
      name: newPlanName,
      mode: newPlanMode,
      period_months: newPlanPeriod,
      budget_approved: newPlanBudget,
    });
    setSelectedPlanId(result.id);
    setShowNewPlan(false);
  };

  const handleAddBudgetLine = (category: string, subcategory: string) => {
    if (!selectedPlanId) return;
    const period = plan?.period_months ?? 12;
    createLine.mutate({
      plan_id: selectedPlanId,
      category,
      subcategory,
      description: "",
      quantidade: 1,
      valor_unitario: 0,
      encargos_pct: 0,
      beneficios: 0,
      valor_mensal: 0,
      valor_total: 0,
    });
  };

  const handleAddChannel = (channelType: string = "digital") => {
    if (!selectedPlanId) return;
    createChannel.mutate({
      plan_id: selectedPlanId,
      name: channelType === "feira" ? "Nova Feira/Evento" : "Novo Canal",
      is_custom: true,
      channel_type: channelType,
    });
  };

  // ─── No plans state ───
  if (plans.length === 0 && !showNewPlan) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Nenhum plano comercial cadastrado</p>
        <Button onClick={() => setShowNewPlan(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Plano Comercial
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget exceeded alert */}
      {budgetExceeded && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-medium text-destructive">Orçamento excedido!</p>
            <p className="text-muted-foreground">
              O total planejado ({fmt(budgetTotals.total)}) excede o orçamento aprovado ({fmt(Number(plan!.budget_approved))}). Este orçamento precisará ser aprovado pelo Departamento Financeiro e Diretoria de Operações.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setShowBudgetAlert(true)}>
            Solicitar Aprovação
          </Button>
        </div>
      )}

      {/* Plan Selector + Mode */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedPlanId ?? ""} onValueChange={setSelectedPlanId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecione um plano" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.mode === "top_down" ? "Top-down" : "Bottom-up"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setShowNewPlan(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Novo Plano
        </Button>

        {plan && (
          <>
            <Badge variant="secondary" className="ml-auto">
              {plan.mode === "top_down" ? "Modo A — Top-down" : "Modo B — Bottom-up"}
            </Badge>
            <Badge variant="outline">{plan.period_months} meses</Badge>
          </>
        )}
      </div>

      {/* KPI Cards */}
      {plan && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard title="Orçamento Aprovado" value={fmt(Number(plan.budget_approved))} icon={<Wallet size={18} />} />
            {plan.mode === "bottom_up" && (
              <KPICard title="Orç. Solicitado" value={fmt(budgetTotals.total)} icon={<DollarSign size={18} />} />
            )}
            <KPICard
              title="Comprometido"
              value={fmtPct(globalMetrics.comprometido)}
              icon={<ArrowUpDown size={18} />}
            />
            <KPICard
              title="Runway Comercial"
              value={globalMetrics.runwayComercial === Infinity ? "∞" : `${globalMetrics.runwayComercial.toFixed(1)} meses`}
              icon={<Clock size={18} />}
            />
            <KPICard title="Receita Projetada" value={fmt(globalMetrics.receita)} icon={<TrendingUp size={18} />} />
            <KPICard title="ROI Global" value={fmtPct(globalMetrics.roi)} icon={<Percent size={18} />} />
            <KPICard
              title="Payback"
              value={globalMetrics.payback === Infinity ? "∞" : `${globalMetrics.payback.toFixed(1)} meses`}
              icon={<Target size={18} />}
            />
          </div>

          {/* Inner Tabs */}
          <Tabs defaultValue="orcamento" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
              <TabsTrigger value="funil">Funil & Canais</TabsTrigger>
              <TabsTrigger value="projecao">Projeção</TabsTrigger>
              <TabsTrigger value="cenarios">Cenários</TabsTrigger>
              <TabsTrigger value="simulador" className="gap-1">
                <Calculator className="h-3 w-3" /> Simulador
              </TabsTrigger>
            </TabsList>

            {/* ─── BUDGET TAB ─── */}
            <TabsContent value="orcamento">
              <div className="space-y-4">
                {/* Fixed Costs */}
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">A) Custos Fixos — OPEX Comercial</h4>
                    <span className="text-xs text-muted-foreground font-mono">{fmt(budgetTotals.fixos)}</span>
                  </div>

                  {/* Equipe */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground">Equipe</p>
                      <Button variant="ghost" size="sm" onClick={() => handleAddBudgetLine("fixo", "equipe")} className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" /> Adicionar
                      </Button>
                    </div>
                    <BudgetLineTable
                      lines={lines.filter((l) => l.category === "fixo" && l.subcategory === "equipe")}
                      columns={["Cargo/Função", "Qtd", "Salário (R$)", "Encargos (%)", "Benefícios (R$)", "Total Mensal", "Total Período"]}
                      period={plan.period_months}
                      onUpdate={updateLine.mutate}
                      onDelete={deleteLine.mutate}
                      showEncargos
                    />
                  </div>

                  <Separator />

                  {/* Software */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground">Softwares e Ferramentas</p>
                      <Button variant="ghost" size="sm" onClick={() => handleAddBudgetLine("fixo", "software")} className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" /> Adicionar
                      </Button>
                    </div>
                    <BudgetLineTable
                      lines={lines.filter((l) => l.category === "fixo" && l.subcategory === "software")}
                      columns={["Nome", "Valor Mensal (R$)", "Total Período"]}
                      period={plan.period_months}
                      onUpdate={updateLine.mutate}
                      onDelete={deleteLine.mutate}
                    />
                  </div>
                </div>

                {/* Variable Costs */}
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">B) Custos Variáveis</h4>
                    <span className="text-xs text-muted-foreground font-mono">{fmt(budgetTotals.variaveis)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Comissões e Créditos de IA</p>
                    <Button variant="ghost" size="sm" onClick={() => handleAddBudgetLine("variavel", "comissao")} className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" /> Adicionar
                    </Button>
                  </div>
                  <BudgetLineTable
                    lines={lines.filter((l) => l.category === "variavel")}
                    columns={["Descrição", "Valor Mensal (R$)", "Total Período"]}
                    period={plan.period_months}
                    onUpdate={updateLine.mutate}
                    onDelete={deleteLine.mutate}
                  />
                </div>

                {/* Feiras e Eventos */}
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> D) Feiras e Eventos
                    </h4>
                    <span className="text-xs text-muted-foreground font-mono">{fmt(budgetTotals.feiras)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Investimentos em feiras, congressos e eventos</p>
                    <Button variant="ghost" size="sm" onClick={() => handleAddBudgetLine("feira", "evento")} className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" /> Adicionar
                    </Button>
                  </div>
                  <BudgetLineTable
                    lines={lines.filter((l) => l.category === "feira")}
                    columns={["Evento", "Valor Mensal (R$)", "Total Período"]}
                    period={plan.period_months}
                    onUpdate={updateLine.mutate}
                    onDelete={deleteLine.mutate}
                  />
                </div>

                {/* Media */}
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">E) Mídia, Publicidade e Propaganda</h4>
                    <span className="text-xs text-muted-foreground font-mono">{fmt(budgetTotals.midia)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Configuração de orçamento por canal feita na aba "Funil & Canais".</p>
                </div>

                {/* Summary */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Resumo Orçamentário</h4>
                    <Badge variant={budgetExceeded ? "destructive" : "secondary"}>
                      {budgetExceeded ? "EXCEDIDO" : "DENTRO DO LIMITE"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Custos Fixos</p>
                      <p className="text-sm font-semibold font-mono">{fmt(budgetTotals.fixos)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Custos Variáveis</p>
                      <p className="text-sm font-semibold font-mono">{fmt(budgetTotals.variaveis)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Feiras e Eventos</p>
                      <p className="text-sm font-semibold font-mono">{fmt(budgetTotals.feiras)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mídia / Publicidade</p>
                      <p className="text-sm font-semibold font-mono">{fmt(budgetTotals.midia)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Planejado</p>
                      <p className={`text-sm font-bold font-mono ${budgetExceeded ? "text-destructive" : ""}`}>
                        {fmt(budgetTotals.total)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fixed cost allocation mode */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Tratamento de custos fixos nos canais:</span>
                  <Select value={fixedCostMode} onValueChange={(v) => setFixedCostMode(v as any)}>
                    <SelectTrigger className="w-[220px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_rateado">Não rateados (apenas no total)</SelectItem>
                      <SelectItem value="rateado">Rateados por canal (% orçamento)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ─── FUNNEL & CHANNELS TAB ─── */}
            <TabsContent value="funil">
              <div className="space-y-4">
                {/* Digital Channels */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Canais de Venda & Funil de Conversão</h4>
                  <div className="flex gap-2">
                    {channels.filter(c => c.channel_type !== "feira").length === 0 && (
                      <Button variant="outline" size="sm" onClick={() => seedChannels.mutate()} className="gap-1 text-xs">
                        <Sparkles className="h-3.5 w-3.5" /> Canais Padrão
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleAddChannel("digital")} className="gap-1 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Canal Customizado
                    </Button>
                  </div>
                </div>

                {channels.filter(c => c.channel_type !== "feira").length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Sem dados de funil, o sistema não pode projetar receita. Adicione canais para começar.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {channels.filter(c => c.channel_type !== "feira").map((ch) => (
                      <ChannelCard
                        key={ch.id}
                        channel={ch}
                        period={plan.period_months}
                        onUpdate={updateChannel.mutate}
                        onDelete={deleteChannel.mutate}
                      />
                    ))}
                  </div>
                )}

                <Separator className="my-6" />

                {/* Feiras e Eventos */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Feiras e Eventos
                  </h4>
                  <Button variant="outline" size="sm" onClick={() => handleAddChannel("feira")} className="gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Nova Feira / Evento
                  </Button>
                </div>

                {channels.filter(c => c.channel_type === "feira").length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma feira ou evento cadastrado. Adicione para registrar leads gerados.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {channels.filter(c => c.channel_type === "feira").map((ch) => (
                      <ChannelCard
                        key={ch.id}
                        channel={ch}
                        period={plan.period_months}
                        onUpdate={updateChannel.mutate}
                        onDelete={deleteChannel.mutate}
                        isFeira
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── PROJECTION TAB ─── */}
            <TabsContent value="projecao">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Projeção de Receita por Canal</h4>
                  {scenarios.length > 0 && (
                    <Select value={activeScenarioId ?? "realista"} onValueChange={setActiveScenarioId}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Cenário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realista">Sem cenário</SelectItem>
                        {scenarios.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {projections.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Configure canais e dados de funil para ver projeções.
                  </p>
                ) : (
                  <div className="glass-card overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Canal</TableHead>
                          <TableHead className="text-xs text-right">Orçamento</TableHead>
                          <TableHead className="text-xs text-right">Leads</TableHead>
                          <TableHead className="text-xs text-right">Oportunidades</TableHead>
                          <TableHead className="text-xs text-right">Propostas</TableHead>
                          <TableHead className="text-xs text-right">Vendas</TableHead>
                          <TableHead className="text-xs text-right">Ticket Médio</TableHead>
                          <TableHead className="text-xs text-right">Receita</TableHead>
                          <TableHead className="text-xs text-right">Comissão</TableHead>
                          <TableHead className="text-xs text-right">ROI</TableHead>
                          <TableHead className="text-xs text-right">Payback</TableHead>
                          <TableHead className="text-xs text-right">Ciclo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projections.map((p) => (
                          <TableRow key={p.channel.id}>
                            <TableCell className="text-xs font-medium">{p.channel.name}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{fmt(p.custoTotal)}</TableCell>
                            <TableCell className="text-xs text-right">{p.leads}</TableCell>
                            <TableCell className="text-xs text-right">{p.oportunidades}</TableCell>
                            <TableCell className="text-xs text-right">{p.propostas}</TableCell>
                            <TableCell className="text-xs text-right">{p.vendas}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{fmt(p.ticket)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{fmt(p.receita)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{fmt(p.comissao)}</TableCell>
                            <TableCell className={`text-xs text-right font-bold ${p.roi >= 0 ? "text-success" : "text-destructive"}`}>
                              {fmtPct(p.roi)}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {p.payback === Infinity ? "∞" : `${p.payback.toFixed(1)}m`}
                            </TableCell>
                            <TableCell className="text-xs text-right">{p.channel.ciclo_medio_dias}d</TableCell>
                          </TableRow>
                        ))}
                        {/* Totals row */}
                        <TableRow className="border-t-2 border-border font-bold">
                          <TableCell className="text-xs">TOTAL</TableCell>
                          <TableCell className="text-xs text-right font-mono">{fmt(budgetTotals.total)}</TableCell>
                          <TableCell className="text-xs text-right">{globalMetrics.leads}</TableCell>
                          <TableCell className="text-xs text-right">—</TableCell>
                          <TableCell className="text-xs text-right">—</TableCell>
                          <TableCell className="text-xs text-right">{globalMetrics.vendas}</TableCell>
                          <TableCell className="text-xs text-right">—</TableCell>
                          <TableCell className="text-xs text-right font-mono">{fmt(globalMetrics.receita)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{fmt(globalMetrics.comissao)}</TableCell>
                          <TableCell className={`text-xs text-right ${globalMetrics.roi >= 0 ? "text-success" : "text-destructive"}`}>
                            {fmtPct(globalMetrics.roi)}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {globalMetrics.payback === Infinity ? "∞" : `${globalMetrics.payback.toFixed(1)}m`}
                          </TableCell>
                          <TableCell className="text-xs text-right">—</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Alerts */}
                <div className="space-y-2">
                  {channels.some((ch) => ch.leads_projetados === 0) && (
                    <AlertBanner message="Dados de funil ausentes em um ou mais canais. Preencha leads e conversões para projetar receita." />
                  )}
                  {globalMetrics.roi < 0 && (
                    <AlertBanner message="ROI global negativo. O investimento comercial não está retornando o capital investido." />
                  )}
                  {globalMetrics.payback !== Infinity && globalMetrics.payback > (plan.period_months) && (
                    <AlertBanner message={`Payback (${globalMetrics.payback.toFixed(1)} meses) é maior que o período planejado (${plan.period_months} meses).`} />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── SCENARIOS TAB ─── */}
            <TabsContent value="cenarios">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Simulador de Cenários</h4>
                  {scenarios.length === 0 && (
                    <Button variant="outline" size="sm" onClick={() => seedScenarios.mutate()} className="gap-1 text-xs">
                      <Sparkles className="h-3.5 w-3.5" /> Criar Cenários Padrão
                    </Button>
                  )}
                </div>

                {scenarios.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {scenarios.filter((s) => s.is_active).map((sc) => (
                        <ScenarioCard key={sc.id} scenario={sc} channels={channels} period={plan.period_months} budgetTotal={budgetTotals.total} />
                      ))}
                    </div>

                    {scenarioChartData.length > 0 && (
                      <div className="glass-card p-4">
                        <h5 className="text-xs font-semibold mb-3">Comparativo de Cenários</h5>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={scenarioChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                              formatter={(v: number, name: string) => [name === "receita" ? fmt(v) : fmtPct(v), name === "receita" ? "Receita" : "ROI"]}
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* ─── TICKET SIMULATOR TAB ─── */}
            <TabsContent value="simulador">
              <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Carregando simulador...</div>}>
                <TicketSimulator />
              </Suspense>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ─── New Plan Dialog ─── */}
      <Dialog open={showNewPlan} onOpenChange={setShowNewPlan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Plano Comercial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Modo de Planejamento</Label>
              <Select value={newPlanMode} onValueChange={(v) => setNewPlanMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top_down">Modo A — Orçamento Pré-definido (Top-down)</SelectItem>
                  <SelectItem value="bottom_up">Modo B — Orçamento Solicitado (Bottom-up)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Período (meses)</Label>
              <Select value={String(newPlanPeriod)} onValueChange={(v) => setNewPlanPeriod(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 6, 12, 18, 24].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} meses</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Orçamento Comercial Aprovado (R$)</Label>
              <Input type="number" value={newPlanBudget} onChange={(e) => setNewPlanBudget(Number(e.target.value))} />
              {versions.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ou importe do orçamento anual cadastrado (em breve).
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewPlan(false)}>Cancelar</Button>
            <Button onClick={handleCreatePlan} disabled={createPlan.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget exceeded alert dialog */}
      <Dialog open={showBudgetAlert} onOpenChange={setShowBudgetAlert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Orçamento Excedido
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O orçamento comercial planejado ({fmt(budgetTotals.total)}) excede o valor aprovado ({fmt(Number(plan?.budget_approved ?? 0))}). 
            Este novo orçamento precisará ser aprovado pelo <strong>Departamento Financeiro</strong> e pela <strong>Diretoria de Operações</strong>.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBudgetAlert(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───

function AlertBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

interface BudgetLineTableProps {
  lines: any[];
  columns: string[];
  period: number;
  onUpdate: (data: any) => void;
  onDelete: (id: string) => void;
  showEncargos?: boolean;
}

function BudgetLineTable({ lines, columns, period, onUpdate, onDelete, showEncargos }: BudgetLineTableProps) {
  if (lines.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Nenhuma linha cadastrada.</p>;
  }

  const handleChange = (line: any, field: string, value: any) => {
    const updated = { ...line, [field]: value };
    const qty = Number(updated.quantidade) || 1;
    const unit = Number(updated.valor_unitario) || 0;
    const enc = Number(updated.encargos_pct) || 0;
    const ben = Number(updated.beneficios) || 0;
    const mensal = (unit * qty * (1 + enc / 100)) + ben;
    const total = mensal * period;
    onUpdate({ id: line.id, [field]: value, valor_mensal: mensal, valor_total: total });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="text-xs">{c}</TableHead>
            ))}
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line: any) => (
            <TableRow key={line.id}>
              <TableCell>
                <DebouncedInput
                  className="h-7 text-xs"
                  value={line.description}
                  onChange={(v) => handleChange(line, "description", v)}
                  placeholder="Descrição"
                />
              </TableCell>
              {showEncargos ? (
                <>
                  <TableCell>
                    <DebouncedInput className="h-7 text-xs w-16" type="number" value={line.quantidade} onChange={(v) => handleChange(line, "quantidade", Number(v))} />
                  </TableCell>
                  <TableCell>
                    <DebouncedInput className="h-7 text-xs w-24" type="number" value={line.valor_unitario} onChange={(v) => handleChange(line, "valor_unitario", Number(v))} />
                  </TableCell>
                  <TableCell>
                    <DebouncedInput className="h-7 text-xs w-20" type="number" value={line.encargos_pct} onChange={(v) => handleChange(line, "encargos_pct", Number(v))} />
                  </TableCell>
                  <TableCell>
                    <DebouncedInput className="h-7 text-xs w-24" type="number" value={line.beneficios} onChange={(v) => handleChange(line, "beneficios", Number(v))} />
                  </TableCell>
                </>
              ) : (
                <TableCell>
                  <DebouncedInput className="h-7 text-xs w-28" type="number" value={line.valor_unitario} onChange={(v) => handleChange(line, "valor_unitario", Number(v))} />
                </TableCell>
              )}
              <TableCell className="text-xs text-right font-mono">{fmt(Number(line.valor_mensal))}</TableCell>
              <TableCell className="text-xs text-right font-mono">{fmt(Number(line.valor_total))}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(line.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface ChannelCardProps {
  channel: CommercialChannel;
  period: number;
  onUpdate: (data: any) => void;
  onDelete: (id: string) => void;
  isFeira?: boolean;
}

function ChannelCard({ channel, period, onUpdate, onDelete, isFeira }: ChannelCardProps) {
  const handleChange = (field: string, value: any) => {
    onUpdate({ id: channel.id, [field]: value });
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <DebouncedInput
            className="h-7 text-sm font-semibold w-40 bg-transparent border-none p-0 focus-visible:ring-0"
            value={channel.name}
            onChange={(v) => handleChange("name", v)}
          />
          {channel.is_custom && <Badge variant="outline" className="text-[10px]">Custom</Badge>}
          {isFeira && <Badge variant="secondary" className="text-[10px]">Feira/Evento</Badge>}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(channel.id)}>
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Orçamento Alocado (R$)</Label>
          <DebouncedInput className="h-7 text-xs" type="number" value={channel.orcamento_alocado} onChange={(v) => handleChange("orcamento_alocado", Number(v))} />
        </div>
        {!isFeira && (
          <div>
            <Label className="text-[10px] text-muted-foreground">CPL Estimado (R$/lead)</Label>
            <DebouncedInput className="h-7 text-xs" type="number" value={channel.cpl_estimado} onChange={(v) => handleChange("cpl_estimado", Number(v))} />
          </div>
        )}
        <div>
          <Label className="text-[10px] text-muted-foreground">Leads Projetados</Label>
          <DebouncedInput className="h-7 text-xs" type="number" value={channel.leads_projetados} onChange={(v) => handleChange("leads_projetados", Number(v))} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Ticket Médio (R$)</Label>
          <DebouncedInput className="h-7 text-xs" type="number" value={channel.ticket_medio} onChange={(v) => handleChange("ticket_medio", Number(v))} />
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Lead → Oportunidade (%)</Label>
          <DebouncedInput className="h-7 text-xs" type="number" value={channel.conv_lead_oportunidade} onChange={(v) => handleChange("conv_lead_oportunidade", Number(v))} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Oportunidade → Proposta (%)</Label>
          <DebouncedInput className="h-7 text-xs" type="number" value={channel.conv_oportunidade_proposta} onChange={(v) => handleChange("conv_oportunidade_proposta", Number(v))} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Proposta → Fechamento (%)</Label>
          <DebouncedInput className="h-7 text-xs" type="number" value={channel.conv_proposta_fechamento} onChange={(v) => handleChange("conv_proposta_fechamento", Number(v))} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Ciclo Médio (dias)</Label>
          <DebouncedInput className="h-7 text-xs" type="number" value={channel.ciclo_medio_dias} onChange={(v) => handleChange("ciclo_medio_dias", Number(v))} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Tipo de Contrato</Label>
          <Select value={channel.tipo_contrato} onValueChange={(v) => handleChange("tipo_contrato", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pontual">Pontual</SelectItem>
              <SelectItem value="recorrente">Recorrente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {channel.tipo_contrato === "recorrente" && (
          <>
            <div>
              <Label className="text-[10px] text-muted-foreground">MRR (R$)</Label>
              <DebouncedInput className="h-7 text-xs" type="number" value={channel.mrr} onChange={(v) => handleChange("mrr", Number(v))} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Duração Média (meses)</Label>
              <DebouncedInput className="h-7 text-xs" type="number" value={channel.duracao_media_meses} onChange={(v) => handleChange("duracao_media_meses", Number(v))} />
            </div>
          </>
        )}
        <div>
          <Label className="text-[10px] text-muted-foreground">Tipo de Comissão</Label>
          <Select value={channel.comissao_tipo ?? "percentual"} onValueChange={(v) => handleChange("comissao_tipo", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentual">% sobre receita</SelectItem>
              <SelectItem value="fixo">Valor fixo por venda</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          {(channel.comissao_tipo ?? "percentual") === "percentual" ? (
            <>
              <Label className="text-[10px] text-muted-foreground">Comissão (%)</Label>
              <DebouncedInput className="h-7 text-xs" type="number" value={channel.comissao_pct} onChange={(v) => handleChange("comissao_pct", Number(v))} />
            </>
          ) : (
            <>
              <Label className="text-[10px] text-muted-foreground">Comissão (R$/venda)</Label>
              <DebouncedInput className="h-7 text-xs" type="number" value={channel.comissao_valor_fixo ?? 0} onChange={(v) => handleChange("comissao_valor_fixo", Number(v))} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ScenarioCardProps {
  scenario: CommercialScenario;
  channels: CommercialChannel[];
  period: number;
  budgetTotal: number;
}

function ScenarioCard({ scenario, channels, period, budgetTotal }: ScenarioCardProps) {
  const projections = channels.map((ch) => computeChannelProjections(ch, scenario, period));
  const receita = projections.reduce((s, p) => s + p.receita, 0);
  const roi = budgetTotal > 0 ? ((receita - budgetTotal) / budgetTotal) * 100 : 0;
  const vendas = projections.reduce((s, p) => s + p.vendas, 0);

  const typeColors: Record<string, string> = {
    conservador: "border-warning/30",
    realista: "border-primary/30",
    agressivo: "border-success/30",
    personalizado: "border-accent/30",
  };

  return (
    <div className={`glass-card p-4 border-l-2 ${typeColors[scenario.type] ?? "border-border"}`}>
      <h5 className="text-sm font-semibold">{scenario.name}</h5>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Receita</p>
          <p className="text-sm font-mono font-semibold">{fmt(receita)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">ROI</p>
          <p className={`text-sm font-bold ${roi >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(roi)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Vendas</p>
          <p className="text-sm font-mono">{vendas}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Ajustes</p>
          <p className="text-[10px] text-muted-foreground">
            Conv: {scenario.ajuste_conversao > 0 ? "+" : ""}{scenario.ajuste_conversao}% | 
            Ticket: {scenario.ajuste_ticket > 0 ? "+" : ""}{scenario.ajuste_ticket}%
          </p>
        </div>
      </div>
    </div>
  );
}
