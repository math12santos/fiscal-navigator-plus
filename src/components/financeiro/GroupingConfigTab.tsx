import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Edit2, Trash2, Layers, Wand2, ChevronDown, ChevronRight,
  Search, FlaskConical, AlertCircle, Clock, FileText, ArrowRight, Sparkles,
} from "lucide-react";
import { useGroupingRules, type GroupingRule, MATCH_FIELD_OPTIONS, OPERATOR_OPTIONS } from "@/hooks/useGroupingRules";
import { useGroupingMacrogroups } from "@/hooks/useGroupingMacrogroups";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { useEntities } from "@/hooks/useEntities";
import { useCostCenters } from "@/hooks/useCostCenters";
import GroupingRuleDialog from "@/components/financeiro/GroupingRuleDialog";
import GroupingMacrogroupManager from "@/components/financeiro/GroupingMacrogroupManager";
import GroupingPropagation from "@/components/financeiro/GroupingPropagation";
import SuggestedRuleTemplates from "@/components/financeiro/SuggestedRuleTemplates";
import AIRuleSuggestions from "@/components/financeiro/AIRuleSuggestions";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

export default function GroupingConfigTab() {
  // Data hooks
  const {
    rules: groupingRules, isLoading: loadingRules,
    create: createRule, update: updateRule, remove: removeRule,
    toggleEnabled: toggleRule, activeRules, getMatchingRule, getGroupLabel,
  } = useGroupingRules();
  const { macrogroups, groups, groupOptions, isLoading: loadingMacrogroups, getGroupsForMacrogroup } = useGroupingMacrogroups();
  const { entries: saidaEntries } = useFinanceiro("saida");
  const { entries: entradaEntries } = useFinanceiro("entrada");
  const { entities } = useEntities();
  const { costCenters } = useCostCenters();

  const allEntries = useMemo(() => [...saidaEntries, ...entradaEntries], [saidaEntries, entradaEntries]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<GroupingRule | null>(null);

  // Filter state for rules
  const [ruleFilterMacrogroup, setRuleFilterMacrogroup] = useState("__all__");
  const [ruleFilterField, setRuleFilterField] = useState("__all__");
  const [ruleFilterStatus, setRuleFilterStatus] = useState("__all__");

  // Simulation state
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const [simSelectedEntries, setSimSelectedEntries] = useState<string[]>([]);
  const [simSearch, setSimSearch] = useState("");

  // Dynamic options
  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    allEntries.forEach((e) => { if (e.categoria) cats.add(e.categoria); });
    return Array.from(cats).sort().map((c) => ({ value: c, label: c }));
  }, [allEntries]);

  const entityOptions = useMemo(
    () => entities.filter((e) => e.active).map((e) => ({ value: e.id, label: e.name })),
    [entities]
  );

  const costCenterOpts = useMemo(
    () => costCenters.filter((c) => c.active).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
    [costCenters]
  );

  // ── KPI Computations ──
  const activeMacroCount = macrogroups.filter((m) => m.enabled).length;
  const activeRuleCount = groupingRules.filter((r) => r.enabled).length;

  const unclassifiedEntries = useMemo(() => {
    return allEntries.filter((e) => {
      const rule = getMatchingRule(e);
      return !rule;
    });
  }, [allEntries, getMatchingRule]);

  const unclassifiedTotal = useMemo(
    () => unclassifiedEntries.reduce((s, e) => s + Number(e.valor_previsto), 0),
    [unclassifiedEntries]
  );

  const lastUpdated = useMemo(() => {
    const allDates = [
      ...groupingRules.map((r) => r.updated_at),
      ...macrogroups.map((m) => m.updated_at),
    ].filter(Boolean).sort().reverse();
    return allDates[0] ? format(parseISO(allDates[0]), "dd/MM/yyyy HH:mm") : "—";
  }, [groupingRules, macrogroups]);

  // ── Monthly value per group ──
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const ruleCountByGroup = useMemo(() => {
    const map = new Map<string, number>();
    groupingRules.forEach((r) => {
      if (r.group_id) map.set(r.group_id, (map.get(r.group_id) ?? 0) + 1);
    });
    return map;
  }, [groupingRules]);

  // ── Filtered rules ──
  const filteredRules = useMemo(() => {
    return groupingRules.filter((r) => {
      if (ruleFilterStatus === "active" && !r.enabled) return false;
      if (ruleFilterStatus === "inactive" && r.enabled) return false;
      if (ruleFilterField !== "__all__" && r.match_field !== ruleFilterField) return false;
      if (ruleFilterMacrogroup !== "__all__") {
        if (!r.group_id) return false;
        const group = groups.find((g) => g.id === r.group_id);
        if (!group || group.macrogroup_id !== ruleFilterMacrogroup) return false;
      }
      return true;
    });
  }, [groupingRules, ruleFilterStatus, ruleFilterField, ruleFilterMacrogroup, groups]);

  // ── Simulation results ──
  const simResults = useMemo(() => {
    return simSelectedEntries.map((id) => {
      const entry = allEntries.find((e) => e.id === id);
      if (!entry) return null;
      const rule = getMatchingRule(entry);
      const groupLabel = getGroupLabel(entry);
      const destGroup = rule?.group_id ? groups.find((g) => g.id === rule.group_id) : null;
      const destMacro = destGroup ? macrogroups.find((m) => m.id === destGroup.macrogroup_id) : null;
      return {
        entry,
        rule,
        groupLabel,
        destGroup: destGroup?.name ?? null,
        destMacro: destMacro?.name ?? null,
        priority: rule?.priority ?? null,
        isFallback: !rule,
        trail: rule
          ? `${MATCH_FIELD_OPTIONS.find((o) => o.value === rule.match_field)?.label ?? rule.match_field} ${OPERATOR_OPTIONS.find((o) => o.value === rule.operator)?.label ?? rule.operator} "${rule.match_field === "descricao" ? rule.match_keyword : rule.match_value}" → ${destGroup?.name ?? rule.name}`
          : "Nenhuma regra correspondente → Fallback",
      };
    }).filter(Boolean) as any[];
  }, [simSelectedEntries, allEntries, getMatchingRule, getGroupLabel, groups, macrogroups]);

  const filteredSimEntries = useMemo(() => {
    if (!simSearch) return allEntries.slice(0, 50);
    const q = simSearch.toLowerCase();
    return allEntries.filter((e) => e.descricao?.toLowerCase().includes(q)).slice(0, 50);
  }, [allEntries, simSearch]);

  // ── Unclassified panel state ──
  const [showUnclassified, setShowUnclassified] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* ════════ ZONA 1 — Cabeçalho + KPIs ════════ */}
      <div>
        <h2 className="text-lg font-semibold">Motor de Aglutinação</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a hierarquia de macrogrupos, grupos e regras que classificam automaticamente os lançamentos financeiros
          no Aging List e nos módulos de Contas a Pagar/Receber.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Macrogrupos Ativos</span>
            </div>
            <p className="text-2xl font-bold">{activeMacroCount}</p>
            <p className="text-xs text-muted-foreground">{macrogroups.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Regras Ativas</span>
            </div>
            <p className="text-2xl font-bold">{activeRuleCount}</p>
            <p className="text-xs text-muted-foreground">{groupingRules.length} total</p>
          </CardContent>
        </Card>
        <Card className={unclassifiedEntries.length > 0 ? "border-destructive/50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-xs font-medium text-muted-foreground">Sem Classificação</span>
            </div>
            <p className="text-2xl font-bold">{unclassifiedEntries.length}</p>
            <p className="text-xs text-muted-foreground">{fmt.format(unclassifiedTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Última Atualização</span>
            </div>
            <p className="text-sm font-medium mt-1">{lastUpdated}</p>
          </CardContent>
        </Card>
      </div>

      {/* ════════ Propagação Holding ════════ */}
      <GroupingPropagation />

      {/* ════════ ZONA 2 — 2 Colunas ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Esquerda — Macrogrupos & Grupos + Templates */}
        <Card className="h-fit">
          <CardContent className="pt-6 space-y-6">
            <GroupingMacrogroupManager ruleCountByGroup={ruleCountByGroup} />
            <SuggestedRuleTemplates />
          </CardContent>
        </Card>

        {/* Coluna Direita — Regras de Classificação */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Regras de Classificação</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(true)}>
                  <Sparkles size={14} /> Sugerir com IA
                </Button>
                <Button size="sm" onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
                  <Plus size={14} /> Nova Regra
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Select value={ruleFilterMacrogroup} onValueChange={setRuleFilterMacrogroup}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Macrogrupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos macrogrupos</SelectItem>
                  {macrogroups.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ruleFilterField} onValueChange={setRuleFilterField}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Campo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos campos</SelectItem>
                  {MATCH_FIELD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ruleFilterStatus} onValueChange={setRuleFilterStatus}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingRules ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredRules.length === 0 ? (
              ruleFilterMacrogroup !== "__all__" || ruleFilterField !== "__all__" || ruleFilterStatus !== "__all__" ? (
                <div className="text-center py-8 text-muted-foreground space-y-2">
                  <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm">Nenhuma regra encontrada com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    Exemplos de como regras podem classificar seus lançamentos automaticamente:
                  </p>
                  {[
                    { field: "Categoria", op: "é igual a", value: "Benefícios", dest: "Benefícios" },
                    { field: "Fornecedor", op: "contém", value: "CPFL", dest: "Energia" },
                    { field: "Descrição", op: "contém", value: "aluguel", dest: "Aluguel" },
                  ].map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-dashed bg-muted/20">
                      <Badge variant="secondary" className="text-[10px] shrink-0">{ex.field}</Badge>
                      <Badge variant="outline" className="text-[10px] shrink-0">{ex.op}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">"{ex.value}"</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <Badge className="text-[10px] shrink-0">{ex.dest}</Badge>
                    </div>
                  ))}
                  <div className="text-center pt-2">
                    <Button size="sm" onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
                      <Plus size={14} /> Criar sua primeira regra
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-center w-16">Pri.</TableHead>
                      <TableHead className="text-center w-16">Ativo</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((r) => {
                      const fieldLabel = MATCH_FIELD_OPTIONS.find((o) => o.value === r.match_field)?.label ?? r.match_field;
                      const opLabel = OPERATOR_OPTIONS.find((o) => o.value === r.operator)?.label ?? r.operator;
                      const valDisplay = r.match_field === "descricao" ? (r.match_keyword ?? "") : r.match_value;
                      const groupLabel = r.group_id ? (groupOptions.find((o) => o.value === r.group_id)?.label ?? "—") : "—";

                      return (
                        <TableRow key={r.id} className={!r.enabled ? "opacity-50" : ""}>
                          <TableCell className="font-medium text-xs">{r.name}</TableCell>
                          <TableCell className="text-xs">
                            <span className="text-muted-foreground">{fieldLabel}</span>{" "}
                            <Badge variant="outline" className="text-[10px]">{opLabel}</Badge>{" "}
                            <span className="font-mono text-[10px]">{valDisplay?.slice(0, 20)}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{groupLabel}</TableCell>
                          <TableCell className="text-center text-xs">{r.priority}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={r.enabled} onCheckedChange={(checked) => toggleRule.mutate({ id: r.id, enabled: checked })} className="scale-75" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingRule(r); setDialogOpen(true); }}><Edit2 size={12} /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRule.mutate(r.id)}><Trash2 size={12} className="text-muted-foreground hover:text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ════════ ZONA 3 — Simulação ════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Simular Classificação
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setSimDialogOpen(true)}>
              <Search size={14} /> Selecionar Títulos
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione títulos reais para testar qual regra será aplicada, grupo destino e trilha de decisão.
          </p>
        </CardHeader>
        <CardContent>
          {simResults.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhum título selecionado. Clique em "Selecionar Títulos" para testar as regras.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Regra Aplicada</TableHead>
                  <TableHead>Grupo Destino</TableHead>
                  <TableHead className="text-center">Prioridade</TableHead>
                  <TableHead>Trilha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simResults.map((r: any, i: number) => (
                  <TableRow key={i} className={r.isFallback ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium text-xs max-w-[180px] truncate">{r.entry.descricao}</TableCell>
                    <TableCell>
                      {r.rule ? (
                        <Badge variant="secondary" className="text-xs">{r.rule.name}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Fallback</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.destMacro && <span className="text-muted-foreground">{r.destMacro} → </span>}
                      <span className="font-medium">{r.destGroup ?? r.groupLabel}</span>
                    </TableCell>
                    <TableCell className="text-center text-xs">{r.priority ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                      <span className="truncate block">{r.trail}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ════════ ZONA 4 — Saneamento (2 cards) ════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1 — Status */}
        <Card className={unclassifiedEntries.length > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Não Classificados</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Grupo destino</span>
                <Badge variant="outline" className="text-xs">Não Classificado</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quantidade</span>
                <span className="text-lg font-bold">{unclassifiedEntries.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Valor total</span>
                <span className="text-sm font-semibold">{fmt.format(unclassifiedTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2 — Ações */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Ações de Saneamento</span>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowUnclassified(!showUnclassified)}
                disabled={unclassifiedEntries.length === 0}
              >
                <FileText size={14} /> {showUnclassified ? "Ocultar Lançamentos" : "Revisar Agora"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => { setEditingRule(null); setDialogOpen(true); }}
              >
                <Plus size={14} /> Criar Regra
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setSimSelectedEntries(unclassifiedEntries.slice(0, 20).map((e) => e.id));
                }}
                disabled={unclassifiedEntries.length === 0}
              >
                <FlaskConical size={14} /> Testar Regras
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unclassified entries table (expandable) */}
      {showUnclassified && unclassifiedEntries.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unclassifiedEntries.slice(0, 50).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-medium max-w-[200px] truncate">{e.descricao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.categoria ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{e.source}</Badge></TableCell>
                      <TableCell className="text-right text-xs font-medium">{fmt.format(Number(e.valor_previsto))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Simulation Entry Picker Dialog ── */}
      <Dialog open={simDialogOpen} onOpenChange={setSimDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Selecionar Títulos para Simulação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input placeholder="Buscar por descrição..." value={simSearch} onChange={(e) => setSimSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <div className="max-h-[400px] overflow-auto border rounded-md">
              {filteredSimEntries.map((e) => {
                const isSelected = simSelectedEntries.includes(e.id);
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 px-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={() => {
                      setSimSelectedEntries((prev) =>
                        isSelected ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                      );
                    }}
                  >
                    <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-primary border-primary" : "border-input"}`}>
                      {isSelected && <span className="text-primary-foreground text-[10px]">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{e.descricao}</p>
                      <p className="text-[10px] text-muted-foreground">{e.categoria ?? e.source} · {fmt.format(Number(e.valor_previsto))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{simSelectedEntries.length} selecionado(s)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSimSelectedEntries([])}>Limpar</Button>
                <Button size="sm" onClick={() => setSimDialogOpen(false)}>Simular</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI Suggestions Dialog ── */}
      <AIRuleSuggestions open={aiDialogOpen} onOpenChange={setAiDialogOpen} />

      {/* ── Rule Dialog ── */}
      <GroupingRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        categoryOptions={categoryOptions}
        entityOptions={entityOptions}
        costCenterOptions={costCenterOpts}
        groupOptions={groupOptions}
        onSubmit={(data) => {
          if (data.id) {
            updateRule.mutate(data as any, { onSuccess: () => setDialogOpen(false) });
          } else {
            createRule.mutate(data, { onSuccess: () => setDialogOpen(false) });
          }
        }}
        isLoading={createRule.isPending || updateRule.isPending}
      />
    </div>
  );
}
