import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDPConfig, useMutateDPConfig, useEmployees } from "@/hooks/useDP";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, TrendingUp, PiggyBank, MinusCircle, Calculator, ArrowRight } from "lucide-react";

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
  const { toast } = useToast();

  const [base, setBase] = useState<Record<string, number>>(DEFAULTS);
  const [customs, setCustoms] = useState<CustomItem[]>([]);

  // Sync local state when remote config loads
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
    }
  }, [config]);

  const handleSave = () => {
    // Sanitize customs: drop blank labels
    const cleanCustoms = customs
      .filter((c) => c.label.trim().length > 0)
      .map((c) => ({ ...c, label: c.label.trim(), pct: Number(c.pct) || 0 }));

    mutate.mutate(
      { ...base, custom_items: cleanCustoms } as any,
      {
        onSuccess: () => toast({ title: "Configurações salvas" }),
        onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
      },
    );
  };

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

  // ===== Impacto estimado: aplica %s atuais (config) e novos (state) sobre a folha base =====
  const folhaBase = useMemo(() => {
    return employees
      .filter((e: any) => e.status === "ativo" && e.contract_type !== "PJ")
      .reduce((acc: number, e: any) => acc + Number(e.salary_base || 0), 0);
  }, [employees]);

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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutate.isPending}>
          <Save size={14} className="mr-1" /> {mutate.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
