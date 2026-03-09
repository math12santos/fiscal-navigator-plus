import { useState, useEffect } from "react";
import { useBudget } from "@/hooks/useBudget";
import { usePlanningScenarios } from "@/hooks/usePlanningScenarios";
import { usePlanningConfig } from "@/hooks/usePlanningConfig";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Target, ClipboardList, TrendingUp, Shield, Plus, Sparkles, Loader2,
} from "lucide-react";

interface Props {
  data: Record<string, any>;
  onChange: (d: Record<string, any>) => void;
}

export function Step6Planejamento({ data, onChange }: Props) {
  const { versions, isLoadingVersions, createVersion } = useBudget();
  const { scenarios, isLoading: loadingScenarios, seedDefaults } = usePlanningScenarios();
  const { config, isLoading: loadingConfig, upsert } = usePlanningConfig();

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  const [budgetStart, setBudgetStart] = useState("");
  const [budgetEnd, setBudgetEnd] = useState("");

  const [saldoMinimo, setSaldoMinimo] = useState(0);
  const [colchao, setColchao] = useState(0);
  const [runwayAlerta, setRunwayAlerta] = useState(3);

  // Init liquidity fields from config
  useEffect(() => {
    if (config) {
      setSaldoMinimo(config.saldo_minimo);
      setColchao(config.colchao_liquidez);
      setRunwayAlerta(config.runway_alerta_meses);
    }
  }, [config]);

  // Sync progress
  useEffect(() => {
    const newData = {
      budget_versions_count: versions.length,
      scenarios_count: scenarios.length,
      config_set: !!config,
    };
    if (
      newData.budget_versions_count !== data.budget_versions_count ||
      newData.scenarios_count !== data.scenarios_count ||
      newData.config_set !== data.config_set
    ) {
      onChange(newData);
    }
  }, [versions.length, scenarios.length, !!config]);

  const handleCreateBudget = () => {
    if (!budgetName || !budgetStart || !budgetEnd) return;
    createVersion.mutate({
      name: budgetName,
      start_date: budgetStart,
      end_date: budgetEnd,
      status: "draft",
      description: null,
    });
    setBudgetName("");
    setBudgetStart("");
    setBudgetEnd("");
    setShowBudgetForm(false);
  };

  const handleSaveLiquidity = () => {
    upsert.mutate({
      saldo_minimo: saldoMinimo,
      colchao_liquidez: colchao,
      runway_alerta_meses: runwayAlerta,
    });
  };

  const loading = isLoadingVersions || loadingScenarios || loadingConfig;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Planejamento Financeiro</h2>
            <p className="text-sm text-muted-foreground">Configure orçamento, cenários e parâmetros de liquidez</p>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={["budget", "scenarios", "liquidity"]} className="space-y-2">
          {/* ── Orçamento ── */}
          <AccordionItem value="budget" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-primary" />
                <span className="font-medium">Orçamento</span>
                <Badge variant="secondary">{versions.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma versão de orçamento criada.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
                  {versions.map((v) => (
                    <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="font-medium text-foreground">{v.name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{v.start_date} → {v.end_date}</span>
                        <Badge variant="outline">{v.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setShowBudgetForm(!showBudgetForm)}>
                  <Plus size={14} className="mr-1" /> Criar Versão
                </Button>
              </div>

              {showBudgetForm && (
                <div className="grid grid-cols-3 gap-2 mt-3 p-3 border rounded-lg bg-muted/30">
                  <Input placeholder="Nome (ex: Orçamento 2026)" value={budgetName} onChange={(e) => setBudgetName(e.target.value)} />
                  <Input type="date" value={budgetStart} onChange={(e) => setBudgetStart(e.target.value)} />
                  <Input type="date" value={budgetEnd} onChange={(e) => setBudgetEnd(e.target.value)} />
                  <div className="col-span-3 flex justify-end">
                    <Button size="sm" onClick={handleCreateBudget} disabled={createVersion.isPending}>
                      {createVersion.isPending ? <Loader2 className="animate-spin" size={14} /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── Cenários ── */}
          <AccordionItem value="scenarios" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                <span className="font-medium">Cenários</span>
                <Badge variant="secondary">{scenarios.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {scenarios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum cenário criado.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
                  {scenarios.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant="outline">{s.type}</Badge>
                        <span>Receita: {s.variacao_receita > 0 ? "+" : ""}{s.variacao_receita}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                {scenarios.length === 0 && (
                  <Button size="sm" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
                    {seedDefaults.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sparkles size={14} className="mr-1" />}
                    Criar Cenários Padrão
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Liquidez ── */}
          <AccordionItem value="liquidity" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                <span className="font-medium">Configurações de Liquidez</span>
                {config && <Badge variant="secondary">Configurado</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Saldo Mínimo (R$)</Label>
                  <Input
                    type="number"
                    value={saldoMinimo}
                    onChange={(e) => setSaldoMinimo(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Colchão de Liquidez (R$)</Label>
                  <Input
                    type="number"
                    value={colchao}
                    onChange={(e) => setColchao(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Alerta de Runway (meses)</Label>
                  <Input
                    type="number"
                    value={runwayAlerta}
                    onChange={(e) => setRunwayAlerta(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={handleSaveLiquidity} disabled={upsert.isPending}>
                  {upsert.isPending ? <Loader2 className="animate-spin" size={14} /> : "Salvar Configuração"}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
