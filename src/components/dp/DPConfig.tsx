import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDPConfig,
  useMutateDPConfig,
  useEmployees,
  usePropagateDPConfigToSubsidiaries,
  useApplyHoldingDPSuggestion,
  useDismissHoldingDPSuggestion,
} from "@/hooks/useDP";
import { useHolding } from "@/contexts/HoldingContext";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  Plus,
  Trash2,
  TrendingUp,
  PiggyBank,
  MinusCircle,
  Calculator,
  ArrowRight,
  Building2,
  CheckCircle2,
  XCircle,
  Send,
  CalendarClock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import DPBusinessDaysCalendar from "./DPBusinessDaysCalendar";
import DPBusinessDaysOverridesReport from "./DPBusinessDaysOverridesReport";

type Category = "encargo" | "provisao" | "desconto";

interface CustomItem {
  id: string;
  category: Category;
  label: string;
  pct: number;
}

interface BaseField {
  key: string;
  label: string;
  hint?: string;
}

const SECTIONS: Record<Category, { title: string; description: string; icon: any; baseFields: BaseField[] }> = {
  encargo: {
    title: "Encargos Sociais",
    description: "Tributos e contribuições patronais incidentes sobre a folha (ônus do empregador).",
    icon: TrendingUp,
    baseFields: [
      { key: "inss_patronal_pct", label: "INSS Patronal (%)", hint: "Contribuição previdenciária patronal" },
      { key: "rat_pct", label: "RAT (%)", hint: "Risco de Acidente de Trabalho" },
      { key: "fgts_pct", label: "FGTS (%)", hint: "Fundo de Garantia por Tempo de Serviço" },
      { key: "terceiros_pct", label: "Terceiros / Sistema S (%)", hint: "SESI, SENAI, INCRA, SEBRAE etc." },
    ],
  },
  provisao: {
    title: "Provisionamentos",
    description: "Reserva mensal contábil para obrigações futuras (férias, 13º).",
    icon: PiggyBank,
    baseFields: [
      { key: "provisao_ferias_pct", label: "Provisão Férias Mensal (%)", hint: "1/12 + 1/3 ≈ 11,11%" },
      { key: "provisao_13_pct", label: "Provisão 13º Mensal (%)", hint: "1/12 ≈ 8,33%" },
    ],
  },
  desconto: {
    title: "Descontos da Folha",
    description: "Valores deduzidos do salário líquido do empregado.",
    icon: MinusCircle,
    baseFields: [
      { key: "vt_desconto_pct", label: "Desconto VT Empregado (%)", hint: "Limite legal: até 6% do salário base" },
    ],
  },
};

const DEFAULTS: Record<string, number> = {
  inss_patronal_pct: 20,
  rat_pct: 2,
  fgts_pct: 8,
  terceiros_pct: 5.8,
  provisao_ferias_pct: 11.11,
  provisao_13_pct: 8.33,
  vt_desconto_pct: 6,
};

export default function DPConfig() {
  const { data: config, isLoading } = useDPConfig();
  const { data: employees = [] } = useEmployees();
  const mutate = useMutateDPConfig();
  const propagate = usePropagateDPConfigToSubsidiaries();
  const applySuggestion = useApplyHoldingDPSuggestion();
  const dismissSuggestion = useDismissHoldingDPSuggestion();
  const { isHolding, subsidiaryOrgs } = useHolding();
  const { toast } = useToast();

  const [base, setBase] = useState<Record<string, number>>(DEFAULTS);
  const [customs, setCustoms] = useState<CustomItem[]>([]);
  const [propagateDialogOpen, setPropagateDialogOpen] = useState(false);
  const [selectedSubsidiaries, setSelectedSubsidiaries] = useState<Set<string>>(new Set());

  // Calendário de desembolsos
  const [schedule, setSchedule] = useState({
    advance_enabled: false,
    advance_pct: 40,
    advance_payment_day: 20,
    salary_payment_day: 5,
    salary_payment_basis: "business_day" as "business_day" | "calendar_day",
    inss_due_day: 20,
    fgts_due_day: 20,
    irrf_due_day: 20,
    benefits_payment_day: -1,
    health_payment_day: 10,
  });

  useEffect(() => {
    if (config) {
      setBase({
        inss_patronal_pct: config.inss_patronal_pct ?? DEFAULTS.inss_patronal_pct,
        rat_pct: config.rat_pct ?? DEFAULTS.rat_pct,
        fgts_pct: config.fgts_pct ?? DEFAULTS.fgts_pct,
        terceiros_pct: config.terceiros_pct ?? DEFAULTS.terceiros_pct,
        provisao_ferias_pct: config.provisao_ferias_pct ?? DEFAULTS.provisao_ferias_pct,
        provisao_13_pct: config.provisao_13_pct ?? DEFAULTS.provisao_13_pct,
        vt_desconto_pct: config.vt_desconto_pct ?? DEFAULTS.vt_desconto_pct,
      });
      setCustoms(Array.isArray((config as any).custom_items) ? ((config as any).custom_items as CustomItem[]) : []);
      const c = config as any;
      setSchedule({
        advance_enabled: !!c.advance_enabled,
        advance_pct: Number(c.advance_pct ?? 40),
        advance_payment_day: Number(c.advance_payment_day ?? 20),
        salary_payment_day: Number(c.salary_payment_day ?? 5),
        salary_payment_basis: (c.salary_payment_basis ?? "business_day") as any,
        inss_due_day: Number(c.inss_due_day ?? 20),
        fgts_due_day: Number(c.fgts_due_day ?? 20),
        irrf_due_day: Number(c.irrf_due_day ?? 20),
        benefits_payment_day: Number(c.benefits_payment_day ?? -1),
        health_payment_day: Number(c.health_payment_day ?? 10),
      });
    }
  }, [config]);

  // Sugestão pendente vinda da holding (apenas em subsidiárias)
  const pendingSuggestion = (config as any)?.pending_holding_suggestion ?? null;

  const handleSave = () => {
    // Sanitize customs: drop blank labels
    const cleanCustoms = customs
      .filter((c) => c.label.trim().length > 0)
      .map((c) => ({ ...c, label: c.label.trim(), pct: Number(c.pct) || 0 }));

    mutate.mutate(
      { ...base, ...schedule, custom_items: cleanCustoms } as any,
      {
        onSuccess: () => {
          toast({ title: "Configurações salvas" });
          // Se é holding e tem subsidiárias, abre modal perguntando se quer propagar
          if (isHolding && subsidiaryOrgs.length > 0) {
            setSelectedSubsidiaries(new Set(subsidiaryOrgs.map((o) => o.id)));
            setPropagateDialogOpen(true);
          }
        },
        onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
      },
    );
  };

  const handlePropagate = () => {
    const cleanCustoms = customs
      .filter((c) => c.label.trim().length > 0)
      .map((c) => ({ ...c, label: c.label.trim(), pct: Number(c.pct) || 0 }));
    propagate.mutate(
      { subsidiaryIds: Array.from(selectedSubsidiaries), base, customs: cleanCustoms },
      {
        onSuccess: ({ count }) => {
          toast({
            title: "Sugestão enviada",
            description: `${count} ${count === 1 ? "subsidiária recebeu" : "subsidiárias receberam"} a sugestão para revisão.`,
          });
          setPropagateDialogOpen(false);
        },
        onError: (e: any) =>
          toast({ title: "Erro ao propagar", description: e?.message, variant: "destructive" }),
      },
    );
  };

  const handleApplySuggestion = () => {
    applySuggestion.mutate(undefined, {
      onSuccess: () => toast({ title: "Sugestão aplicada", description: "Os percentuais da holding foram adotados." }),
      onError: (e: any) =>
        toast({ title: "Erro ao aplicar", description: e?.message, variant: "destructive" }),
    });
  };

  const handleDismissSuggestion = () => {
    dismissSuggestion.mutate(undefined, {
      onSuccess: () => toast({ title: "Sugestão descartada" }),
      onError: (e: any) =>
        toast({ title: "Erro ao descartar", description: e?.message, variant: "destructive" }),
    });
  };

  const toggleSubsidiary = (id: string) => {
    setSelectedSubsidiaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ===== Impacto estimado: aplica %s atuais (config) e novos (state) sobre a folha base =====
  const folhaBase = useMemo(() => {
    return employees
      .filter((e: any) => e.status === "ativo" && e.contract_type !== "PJ")
      .reduce((acc: number, e: any) => acc + Number(e.salary_base || 0), 0);
  }, [employees]);

  const addCustom = (category: Category) => {
    setCustoms((prev) => [
      ...prev,
      { id: crypto.randomUUID(), category, label: "", pct: 0 },
    ]);
  };

  const updateCustom = (id: string, patch: Partial<CustomItem>) => {
    setCustoms((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCustom = (id: string) => {
    setCustoms((prev) => prev.filter((c) => c.id !== id));
  };

  const sumByCategory = (
    src: Record<string, number>,
    customList: CustomItem[],
    keys: string[],
    cat: Category,
  ) => {
    const baseSum = keys.reduce((acc, k) => acc + (Number(src[k]) || 0), 0);
    const customSum = customList
      .filter((c) => c.category === cat && c.label.trim().length > 0)
      .reduce((acc, c) => acc + (Number(c.pct) || 0), 0);
    return baseSum + customSum;
  };

  const impact = useMemo(() => {
    const encargoKeys = SECTIONS.encargo.baseFields.map((f) => f.key);
    const provisaoKeys = SECTIONS.provisao.baseFields.map((f) => f.key);
    const descontoKeys = SECTIONS.desconto.baseFields.map((f) => f.key);

    const currentBase: Record<string, number> = {
      inss_patronal_pct: config?.inss_patronal_pct ?? DEFAULTS.inss_patronal_pct,
      rat_pct: config?.rat_pct ?? DEFAULTS.rat_pct,
      fgts_pct: config?.fgts_pct ?? DEFAULTS.fgts_pct,
      terceiros_pct: config?.terceiros_pct ?? DEFAULTS.terceiros_pct,
      provisao_ferias_pct: config?.provisao_ferias_pct ?? DEFAULTS.provisao_ferias_pct,
      provisao_13_pct: config?.provisao_13_pct ?? DEFAULTS.provisao_13_pct,
      vt_desconto_pct: config?.vt_desconto_pct ?? DEFAULTS.vt_desconto_pct,
    };
    const currentCustoms = (Array.isArray((config as any)?.custom_items)
      ? ((config as any).custom_items as CustomItem[])
      : []);

    const calc = (src: Record<string, number>, customList: CustomItem[]) => {
      const encPct = sumByCategory(src, customList, encargoKeys, "encargo");
      const provPct = sumByCategory(src, customList, provisaoKeys, "provisao");
      const descPct = sumByCategory(src, customList, descontoKeys, "desconto");
      const encargos = folhaBase * (encPct / 100);
      const provisoes = folhaBase * (provPct / 100);
      const descontos = folhaBase * (descPct / 100);
      // Custo total mensal para o empregador = folha + encargos + provisões (descontos não somam ao custo do empregador)
      const custoTotal = folhaBase + encargos + provisoes;
      return { encPct, provPct, descPct, encargos, provisoes, descontos, custoTotal };
    };

    const atual = calc(currentBase, currentCustoms);
    const novo = calc(base, customs);

    return {
      atual,
      novo,
      diffCusto: novo.custoTotal - atual.custoTotal,
      diffEncargos: novo.encargos - atual.encargos,
      diffProvisoes: novo.provisoes - atual.provisoes,
      diffDescontos: novo.descontos - atual.descontos,
      pctCusto: atual.custoTotal > 0 ? ((novo.custoTotal - atual.custoTotal) / atual.custoTotal) * 100 : 0,
    };
  }, [config, base, customs, folhaBase]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtSigned = (v: number) =>
    `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 })}`;

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Parâmetros do Departamento Pessoal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Defina os percentuais que servem de base para o cálculo de <strong>encargos</strong>, <strong>provisionamentos</strong> e <strong>descontos</strong> aplicados à folha salarial. Você pode editar os itens padrão e adicionar novos itens customizados em cada categoria.
          </p>
        </CardContent>
      </Card>

      {/* Calendário de dias úteis (afeta VT, VA por dia e demais cálculos proporcionais) */}
      <DPBusinessDaysCalendar />

      {/* Auditoria CFO-first: histórico completo de overrides mensais e individuais */}
      <DPBusinessDaysOverridesReport />

      {/* Banner de sugestão pendente vinda da Holding (apenas em subsidiárias) */}
      {pendingSuggestion && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2">
                <Building2 size={16} className="mt-0.5 text-warning" />
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Sugestão da Holding pendente de revisão
                    <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
                      Aguardando decisão
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>{pendingSuggestion.suggested_by_org_name ?? "Holding"}</strong> propôs novos percentuais de encargos, provisionamentos e descontos.
                    {pendingSuggestion.suggested_at && (
                      <> Recebido em {new Date(pendingSuggestion.suggested_at).toLocaleDateString("pt-BR")}.</>
                    )}
                    {" "}Os valores atuais permanecem ativos até você decidir.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismissSuggestion}
                  disabled={dismissSuggestion.isPending}
                  className="h-8 text-xs"
                >
                  <XCircle size={12} className="mr-1" /> Descartar
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplySuggestion}
                  disabled={applySuggestion.isPending}
                  className="h-8 text-xs"
                >
                  <CheckCircle2 size={12} className="mr-1" />
                  {applySuggestion.isPending ? "Aplicando..." : "Aplicar sugestão"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-md border border-border bg-background/60 p-2.5 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Comparação: atual → sugerido
              </p>
              <div className="grid gap-1 sm:grid-cols-2 text-[11px] font-mono">
                {(Object.keys(SECTIONS) as Category[]).flatMap((cat) =>
                  SECTIONS[cat].baseFields.map((f) => {
                    const atual = base[f.key] ?? 0;
                    const sugerido = (pendingSuggestion.base ?? {})[f.key] ?? atual;
                    const changed = Math.abs(Number(atual) - Number(sugerido)) > 0.001;
                    return (
                      <div
                        key={f.key}
                        className={`flex items-center justify-between gap-2 py-0.5 ${changed ? "" : "opacity-50"}`}
                      >
                        <span className="text-muted-foreground truncate">{f.label}</span>
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">{Number(atual).toFixed(2)}%</span>
                          <ArrowRight size={9} className="text-muted-foreground" />
                          <span className={changed ? "text-warning font-semibold" : "text-foreground"}>
                            {Number(sugerido).toFixed(2)}%
                          </span>
                        </span>
                      </div>
                    );
                  }),
                )}
              </div>
              {Array.isArray(pendingSuggestion.custom_items) && pendingSuggestion.custom_items.length > 0 && (
                <p className="text-[10px] text-muted-foreground pt-1 border-t mt-1.5">
                  + {pendingSuggestion.custom_items.length} {pendingSuggestion.custom_items.length === 1 ? "item personalizado" : "itens personalizados"} sugeridos
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(Object.keys(SECTIONS) as Category[]).map((cat) => {
        const section = SECTIONS[cat];
        const Icon = section.icon;
        const sectionCustoms = customs.filter((c) => c.category === cat);

        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Icon size={16} className="mt-0.5 text-primary" />
                  <div>
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => addCustom(cat)} className="h-7 text-xs shrink-0">
                  <Plus size={12} className="mr-1" /> Adicionar item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Base fields */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.baseFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={base[f.key] ?? 0}
                      onChange={(e) => setBase({ ...base, [f.key]: Number(e.target.value) })}
                    />
                    {f.hint && <p className="text-[10px] text-muted-foreground leading-tight">{f.hint}</p>}
                  </div>
                ))}
              </div>

              {/* Custom items */}
              {sectionCustoms.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Itens personalizados
                  </p>
                  <div className="space-y-2">
                    {sectionCustoms.map((item) => (
                      <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto] items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Descrição</Label>
                          <Input
                            placeholder="Ex.: Convênio médico"
                            value={item.label}
                            onChange={(e) => updateCustom(item.id, { label: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Categoria</Label>
                          <Select
                            value={item.category}
                            onValueChange={(v) => updateCustom(item.id, { category: v as Category })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="encargo">Encargo</SelectItem>
                              <SelectItem value="provisao">Provisionamento</SelectItem>
                              <SelectItem value="desconto">Desconto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Percentual (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.pct}
                            onChange={(e) => updateCustom(item.id, { pct: Number(e.target.value) })}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustom(item.id)}
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          aria-label="Remover item"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Impacto estimado das alterações */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <Calculator size={16} className="mt-0.5 text-primary" />
            <div>
              <CardTitle className="text-sm">Impacto estimado das alterações</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparação entre os percentuais salvos e os atuais no formulário, aplicados sobre a folha base de colaboradores ativos (excluindo PJ).
                {" "}
                <strong>Folha base mensal:</strong> {fmt(folhaBase)}
                {folhaBase === 0 && " — cadastre colaboradores ativos para ver o impacto monetário."}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Linha por categoria */}
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              { key: "encargos", label: "Encargos", atualPct: impact.atual.encPct, novoPct: impact.novo.encPct, atualVal: impact.atual.encargos, novoVal: impact.novo.encargos, diff: impact.diffEncargos, icon: TrendingUp },
              { key: "provisoes", label: "Provisionamentos", atualPct: impact.atual.provPct, novoPct: impact.novo.provPct, atualVal: impact.atual.provisoes, novoVal: impact.novo.provisoes, diff: impact.diffProvisoes, icon: PiggyBank },
              { key: "descontos", label: "Descontos", atualPct: impact.atual.descPct, novoPct: impact.novo.descPct, atualVal: impact.atual.descontos, novoVal: impact.novo.descontos, diff: impact.diffDescontos, icon: MinusCircle },
            ] as const).map((row) => {
              const RowIcon = row.icon;
              const changed = Math.abs(row.diff) > 0.005 || Math.abs(row.novoPct - row.atualPct) > 0.001;
              return (
                <div key={row.key} className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <RowIcon size={12} className="text-primary" /> {row.label}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <span>{fmtPct(row.atualPct)}</span>
                    <ArrowRight size={10} />
                    <span className="text-foreground font-semibold">{fmtPct(row.novoPct)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-muted-foreground">{fmt(row.atualVal)}</span>
                    <ArrowRight size={10} className="text-muted-foreground" />
                    <span className="text-foreground font-semibold">{fmt(row.novoVal)}</span>
                  </div>
                  {changed && folhaBase > 0 && (
                    <div className={`text-[11px] font-mono font-semibold ${row.diff > 0 ? "text-destructive" : row.diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {fmtSigned(row.diff)} / mês
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custo total mensal */}
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Custo total mensal do empregador (folha + encargos + provisões)</p>
                <div className="flex items-center gap-2 mt-1 font-mono">
                  <span className="text-sm text-muted-foreground">{fmt(impact.atual.custoTotal)}</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="text-base font-bold text-foreground">{fmt(impact.novo.custoTotal)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Variação</p>
                <p className={`text-base font-bold font-mono ${impact.diffCusto > 0 ? "text-destructive" : impact.diffCusto < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {fmtSigned(impact.diffCusto)}
                </p>
                <p className={`text-[10px] font-mono ${impact.diffCusto > 0 ? "text-destructive" : impact.diffCusto < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {impact.pctCusto >= 0 ? "+" : ""}{impact.pctCusto.toFixed(2)}%
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Descontos não compõem o custo do empregador — são deduzidos do líquido do colaborador.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutate.isPending}>
          <Save size={14} className="mr-1" /> {mutate.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>

      {/* Modal: propagar percentuais para subsidiárias (apenas em holdings) */}
      <Dialog open={propagateDialogOpen} onOpenChange={setPropagateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send size={16} className="text-primary" />
              Propagar para o grupo?
            </DialogTitle>
            <DialogDescription>
              Os percentuais salvos serão enviados como <strong>sugestão pendente</strong> para as subsidiárias
              selecionadas. Os valores atuais delas <em>não serão sobrescritos</em> — cada subsidiária poderá
              revisar e aplicar a sugestão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-border p-2">
            {subsidiaryOrgs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma subsidiária encontrada.</p>
            ) : (
              subsidiaryOrgs.map((org) => {
                const checked = selectedSubsidiaries.has(org.id);
                return (
                  <label
                    key={org.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubsidiary(org.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <Building2 size={12} className="text-muted-foreground" />
                    <span className="text-sm">{org.name}</span>
                  </label>
                );
              })
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPropagateDialogOpen(false)}>
              Agora não
            </Button>
            <Button
              onClick={handlePropagate}
              disabled={propagate.isPending || selectedSubsidiaries.size === 0}
            >
              <Send size={14} className="mr-1" />
              {propagate.isPending
                ? "Enviando..."
                : `Enviar para ${selectedSubsidiaries.size} ${selectedSubsidiaries.size === 1 ? "empresa" : "empresas"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
