import { useState, useEffect, useMemo } from "react";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Save, Plus, Trash2, HelpCircle, Settings, ChevronRight, Eye, GripVertical, FileText, BarChart3, Cpu, Building2, Target } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";

const STEP_NAMES = [
  "", "Diagnóstico", "Estrutura", "Integrações", "Financeiro", "Contratos",
  "Planejamento", "Rotinas", "Cockpit", "Assistida", "Score",
];

const QUESTION_TYPES = [
  { value: "radio", label: "Radio" },
  { value: "select_input", label: "Select + Input" },
  { value: "number_input", label: "Numérico" },
];

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle size={14} className="text-muted-foreground cursor-help inline-block ml-1" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function OnboardingConfigTab() {
  const { configs, isLoading, saveStepConfig } = useOnboardingConfig();
  const [localConfigs, setLocalConfigs] = useState<Record<number, any>>({});

  useEffect(() => {
    if (configs) {
      const map: Record<number, any> = {};
      configs.forEach((c) => { map[c.step_number] = JSON.parse(JSON.stringify(c.config)); });
      setLocalConfigs(map);
    }
  }, [configs]);

  const updateLocal = (step: number, config: any) => {
    setLocalConfigs((prev) => ({ ...prev, [step]: config }));
  };

  const handleSave = (step: number) => {
    saveStepConfig.mutate({ stepNumber: step, config: localConfigs[step] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure a estrutura de cada etapa do onboarding guiado. As alterações afetam todas as organizações.
        </p>

        <Accordion type="multiple" className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((step) => (
            <AccordionItem key={step} value={`step-${step}`} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="font-medium">Etapa {step} — {STEP_NAMES[step]}</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {step === 1 && localConfigs[1] && (
                  <Step1Config config={localConfigs[1]} onChange={(c) => updateLocal(1, c)} />
                )}
                {step >= 2 && step <= 9 && localConfigs[step] && (
                  <ShellStepConfig config={localConfigs[step]} onChange={(c) => updateLocal(step, c)} />
                )}
                {step === 10 && localConfigs[10] && (
                  <Step10Config config={localConfigs[10]} onChange={(c) => updateLocal(10, c)} />
                )}
                <div className="flex justify-end mt-4">
                  <Button size="sm" onClick={() => handleSave(step)} disabled={saveStepConfig.isPending}>
                    {saveStepConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                    Salvar Etapa {step}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </TooltipProvider>
  );
}

/* ────────────────────────────────────────────────────────────────
   Step 1 Config — Redesigned with sub-tabs
   ──────────────────────────────────────────────────────────────── */

function getQuestionMaxPoints(q: any): number {
  if (q.type === "number_input") return 5;
  return Math.max(0, ...(q.options?.map((o: any) => o.points ?? 0) || [0]));
}

function getSectionMaxPoints(section: any): number {
  if (section.max_points) return section.max_points;
  return section.questions?.reduce((sum: number, q: any) => sum + getQuestionMaxPoints(q), 0) ?? 0;
}

function Step1Config({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const sections = config.sections || [];
  const thresholds = config.thresholds || [];
  const complexityThresholds = config.complexity_thresholds || [];

  const updateSection = (idx: number, section: any) => {
    const updated = [...sections];
    updated[idx] = section;
    onChange({ ...config, sections: updated });
  };

  const addSection = () => {
    onChange({
      ...config,
      sections: [...sections, { key: `section_${Date.now()}`, label: "Nova Seção", icon: "FileText", order: sections.length, questions: [] }],
    });
  };

  const removeSection = (idx: number) => {
    onChange({ ...config, sections: sections.filter((_: any, i: number) => i !== idx) });
  };

  const updateThreshold = (idx: number, field: string, value: any) => {
    const updated = [...thresholds];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...config, thresholds: updated });
  };

  const updateComplexityThreshold = (idx: number, field: string, value: any) => {
    const updated = [...complexityThresholds];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...config, complexity_thresholds: updated });
  };

  const addComplexityThreshold = () => {
    onChange({
      ...config,
      complexity_thresholds: [...complexityThresholds, { label: "Novo Nível", min: 0, max: 0, color: "text-muted-foreground" }],
    });
  };

  const removeComplexityThreshold = (idx: number) => {
    onChange({ ...config, complexity_thresholds: complexityThresholds.filter((_: any, i: number) => i !== idx) });
  };

  const totalMaxPoints = sections.reduce((sum: number, s: any) => sum + getSectionMaxPoints(s), 0);

  return (
    <Tabs defaultValue="perguntas" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
        <TabsTrigger value="pontuacao">Pontuação</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      {/* ── Tab: Perguntas ── */}
      <TabsContent value="perguntas" className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">Seções do Questionário</Label>
            <Badge variant="secondary" className="text-xs">{totalMaxPoints} pts total</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={addSection}><Plus size={14} className="mr-1" /> Seção</Button>
        </div>

        <div className="space-y-3">
          {sections.map((section: any, sIdx: number) => {
            const maxPts = getSectionMaxPoints(section);
            const qCount = section.questions?.length || 0;

            return (
              <Collapsible key={sIdx}>
                <Card className="border">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors group">
                      <GripVertical size={14} className="text-muted-foreground/50" />
                      <ChevronRight size={14} className="text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                      <span className="font-medium text-sm flex-1">{section.label}</span>
                      <Badge variant="outline" className="text-xs">{qCount} perguntas</Badge>
                      <Badge variant="secondary" className="text-xs">{maxPts} pts</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); removeSection(sIdx); }}
                      >
                        <Trash2 size={12} className="text-destructive" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 space-y-3 border-t">
                      <div className="flex items-center gap-2 pt-3">
                        <Input value={section.label} onChange={(e) => updateSection(sIdx, { ...section, label: e.target.value })} placeholder="Nome da seção" className="flex-1 h-8 text-sm" />
                        <Input value={section.icon} onChange={(e) => updateSection(sIdx, { ...section, icon: e.target.value })} placeholder="Ícone" className="w-28 h-8 text-sm" />
                        <Input type="number" value={section.max_points ?? ""} onChange={(e) => updateSection(sIdx, { ...section, max_points: e.target.value ? Number(e.target.value) : undefined })} placeholder="Max pts" className="w-24 h-8 text-sm" />
                      </div>
                      <QuestionsEditor
                        questions={section.questions || []}
                        onChange={(qs) => updateSection(sIdx, { ...section, questions: qs })}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </TabsContent>

      {/* ── Tab: Pontuação ── */}
      <TabsContent value="pontuacao" className="space-y-6 mt-4">
        {/* Maturity Thresholds */}
        <div>
          <div className="flex items-center mb-3">
            <Label className="text-sm font-semibold">Thresholds de Maturidade</Label>
            <InfoTooltip text="Definem os níveis de maturidade do diagnóstico geral com base na pontuação percentual total." />
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground mb-1 px-1">
            <span>Nível</span><span>Label</span><span>Min %</span><span>Max %</span>
          </div>
          {thresholds.map((t: any, idx: number) => (
            <div key={idx} className="grid grid-cols-4 gap-2 mb-1">
              <Input value={t.level} disabled className="h-8 text-sm bg-muted" />
              <Input value={t.label} onChange={(e) => updateThreshold(idx, "label", e.target.value)} className="h-8 text-sm" />
              <Input type="number" value={t.min_score} onChange={(e) => updateThreshold(idx, "min_score", Number(e.target.value))} className="h-8 text-sm" />
              <Input type="number" value={t.max_score} onChange={(e) => updateThreshold(idx, "max_score", Number(e.target.value))} className="h-8 text-sm" />
            </div>
          ))}
        </div>

        {/* Complexity Thresholds */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Label className="text-sm font-semibold">Thresholds de Complexidade por Seção</Label>
              <InfoTooltip text="Definem as badges de complexidade exibidas por seção com base no percentual de pontuação." />
            </div>
            <Button size="sm" variant="outline" onClick={addComplexityThreshold}><Plus size={14} className="mr-1" /> Nível</Button>
          </div>
          <div className="grid grid-cols-[1fr_80px_80px_160px_32px] gap-2 text-xs font-medium text-muted-foreground mb-1 px-1">
            <span>Label</span><span>Min %</span><span>Max %</span><span>Classe CSS</span><span></span>
          </div>
          {complexityThresholds.map((t: any, idx: number) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_80px_160px_32px] gap-2 mb-1">
              <Input value={t.label} onChange={(e) => updateComplexityThreshold(idx, "label", e.target.value)} className="h-8 text-sm" />
              <Input type="number" value={t.min} onChange={(e) => updateComplexityThreshold(idx, "min", Number(e.target.value))} className="h-8 text-sm" />
              <Input type="number" value={t.max} onChange={(e) => updateComplexityThreshold(idx, "max", Number(e.target.value))} className="h-8 text-sm" />
              <Input value={t.color} onChange={(e) => updateComplexityThreshold(idx, "color", e.target.value)} placeholder="text-primary" className="h-8 text-sm" />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeComplexityThreshold(idx)}><Trash2 size={12} className="text-destructive" /></Button>
            </div>
          ))}
          {complexityThresholds.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum threshold configurado. O sistema usará os valores padrão.</p>
          )}
        </div>

        {/* Section summary */}
        <div>
          <Label className="text-sm font-semibold mb-3 block">Resumo de Pontuação por Seção</Label>
          <div className="space-y-2">
            {sections.map((s: any) => {
              const maxPts = getSectionMaxPoints(s);
              const pct = totalMaxPoints > 0 ? Math.round((maxPts / totalMaxPoints) * 100) : 0;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{s.label}</span>
                  <span className="text-sm font-medium text-muted-foreground">{maxPts} pts</span>
                  <Progress value={pct} className="w-24 h-2" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              );
            })}
            <div className="flex items-center gap-3 border-t pt-2">
              <span className="text-sm font-semibold flex-1">Total</span>
              <span className="text-sm font-bold">{totalMaxPoints} pts</span>
              <Progress value={100} className="w-24 h-2" />
              <span className="text-xs font-medium w-10 text-right">100%</span>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── Tab: Preview ── */}
      <TabsContent value="preview" className="mt-4">
        <Step1Preview config={config} />
      </TabsContent>
    </Tabs>
  );
}

/* ────────────────────────────────────────────────────────────────
   Questions Editor — Progressive Disclosure + Settings Popover
   ──────────────────────────────────────────────────────────────── */

function QuestionsEditor({ questions, onChange }: { questions: any[]; onChange: (qs: any[]) => void }) {
  const addQuestion = () => {
    onChange([...questions, { key: `q_${Date.now()}`, label: "Nova pergunta", type: "radio", options: [] }]);
  };

  const removeQuestion = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, q: any) => {
    const updated = [...questions];
    updated[idx] = q;
    onChange(updated);
  };

  const moveQuestion = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onChange(updated);
  };

  return (
    <div className="space-y-1 pl-2 border-l-2 border-muted">
      {questions.map((q: any, qIdx: number) => {
        const maxPts = getQuestionMaxPoints(q);
        const typeLabel = QUESTION_TYPES.find((t) => t.value === (q.type || "radio"))?.label || "Radio";
        const hasConditional = !!q.conditional?.key;
        const optCount = q.options?.length || 0;

        return (
          <Collapsible key={qIdx}>
            <div className="rounded-md border border-transparent hover:border-border transition-colors">
              {/* Summary row */}
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors group text-sm">
                  <GripVertical size={12} className="text-muted-foreground/40 shrink-0" />
                  <ChevronRight size={12} className="text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                  <span className="flex-1 truncate">{q.label || "Sem título"}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{typeLabel}</Badge>
                  {(q.type || "radio") !== "number_input" && (
                    <span className="text-xs text-muted-foreground">{optCount} opções</span>
                  )}
                  <span className="text-xs font-medium text-muted-foreground">{maxPts} pts</span>
                  {hasConditional && (
                    <Eye size={12} className="text-primary shrink-0" />
                  )}
                </div>
              </CollapsibleTrigger>

              {/* Expanded edit */}
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-1 space-y-3 bg-muted/20 rounded-b-md">
                  <div className="flex items-center gap-2">
                    <Input
                      value={q.label}
                      onChange={(e) => updateQuestion(qIdx, { ...q, label: e.target.value })}
                      placeholder="Texto da pergunta"
                      className="flex-1 h-8 text-sm"
                    />
                    {/* Settings popover for technical fields */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0">
                          <Settings size={14} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 space-y-3" align="end">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configurações Avançadas</p>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Key (identificador)</Label>
                            <Input
                              value={q.key || ""}
                              onChange={(e) => updateQuestion(qIdx, { ...q, key: e.target.value })}
                              placeholder="ex: faturamento_mensal"
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tipo de pergunta</Label>
                            <Select value={q.type || "radio"} onValueChange={(val) => updateQuestion(qIdx, { ...q, type: val })}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {QUESTION_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <Label className="text-xs">Condicional: Key</Label>
                              <InfoTooltip text="Se preenchido, esta pergunta só aparece quando a pergunta com esta key tiver o valor especificado." />
                            </div>
                            <Input
                              value={q.conditional?.key || ""}
                              onChange={(e) => updateQuestion(qIdx, {
                                ...q,
                                conditional: e.target.value ? { ...q.conditional, key: e.target.value } : undefined,
                              })}
                              placeholder="ex: usa_erp"
                              className="h-7 text-xs"
                            />
                          </div>
                          {q.conditional?.key && (
                            <div className="space-y-1">
                              <Label className="text-xs">Condicional: Valor</Label>
                              <Input
                                value={q.conditional?.value || ""}
                                onChange={(e) => updateQuestion(qIdx, {
                                  ...q,
                                  conditional: { ...q.conditional, value: e.target.value },
                                })}
                                placeholder="ex: sim"
                                className="h-7 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Reorder + Delete */}
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQuestion(qIdx, -1)} disabled={qIdx === 0}>
                        <ChevronRight size={12} className="rotate-[-90deg]" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQuestion(qIdx, 1)} disabled={qIdx === questions.length - 1}>
                        <ChevronRight size={12} className="rotate-90" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeQuestion(qIdx)}>
                        <Trash2 size={12} className="text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Options editor */}
                  {(q.type || "radio") !== "number_input" ? (
                    <OptionsEditor
                      options={q.options || []}
                      onChange={(opts) => updateQuestion(qIdx, { ...q, options: opts })}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-2">
                      Campo numérico — score calculado dinamicamente (máx. 5 pts).
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
      <Button size="sm" variant="ghost" onClick={addQuestion} className="text-xs"><Plus size={12} className="mr-1" /> Pergunta</Button>
    </div>
  );
}

/* ── Options Editor ── */
function OptionsEditor({ options, onChange }: { options: any[]; onChange: (opts: any[]) => void }) {
  const addOption = () => {
    onChange([...options, { value: `opt_${Date.now()}`, label: "Nova opção", points: 0 }]);
  };

  const removeOption = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, field: string, value: any) => {
    const updated = [...options];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-1 pl-2">
      <div className="grid grid-cols-[1fr_90px_60px_28px] gap-1.5 text-[10px] text-muted-foreground font-medium px-0.5">
        <span>Opção</span><span>Valor (key)</span><span>Pontos</span><span></span>
      </div>
      {options.map((opt: any, idx: number) => (
        <div key={idx} className="grid grid-cols-[1fr_90px_60px_28px] gap-1.5">
          <Input value={opt.label} onChange={(e) => updateOption(idx, "label", e.target.value)} className="h-7 text-xs" />
          <Input value={opt.value || ""} onChange={(e) => updateOption(idx, "value", e.target.value)} className="h-7 text-xs" placeholder="key" />
          <Input type="number" value={opt.points} onChange={(e) => updateOption(idx, "points", Number(e.target.value))} className="h-7 text-xs" />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeOption(idx)}><Trash2 size={10} className="text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={addOption} className="text-xs h-6"><Plus size={10} className="mr-1" /> Opção</Button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Step 1 Preview — Read-only simulation
   ──────────────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, any> = { Building2, BarChart3, FileText, Cpu, Target };

function Step1Preview({ config }: { config: any }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const sections = config.sections || [];
  const set = (key: string, val: string) => setAnswers((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Simulação interativa — teste como o diagnóstico aparece para o usuário.</p>
        <Button size="sm" variant="outline" onClick={() => setAnswers({})}>Limpar respostas</Button>
      </div>

      <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
        <h3 className="text-lg font-bold text-foreground">Diagnóstico Inicial</h3>
        <p className="text-sm text-muted-foreground">Avalie o nível de maturidade e complexidade financeira da sua empresa</p>

        {sections.map((section: any) => {
          const Icon = ICON_MAP[section.icon] || FileText;
          const visibleQuestions = section.questions?.filter((q: any) =>
            !q.conditional || answers[q.conditional.key] === q.conditional.value
          ) || [];

          return (
            <Card key={section.key} className="border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon size={16} className="text-primary" />
                  {section.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-4">
                {visibleQuestions.map((q: any) => {
                  if (q.type === "number_input") {
                    return (
                      <div key={q.key} className="space-y-1">
                        <Label className="text-sm">{q.label}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={answers[q.key] || ""}
                          onChange={(e) => set(q.key, e.target.value)}
                          className="max-w-[200px] h-8 text-sm"
                        />
                      </div>
                    );
                  }

                  if (q.type === "select_input") {
                    return (
                      <div key={q.key} className="space-y-1">
                        <Label className="text-sm">{q.label}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {q.options?.map((opt: any) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => set(q.key, opt.value)}
                              className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                                answers[q.key] === opt.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-foreground border-input hover:bg-accent"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={q.key} className="space-y-1">
                      <Label className="text-sm">{q.label}</Label>
                      <RadioGroup value={answers[q.key] || ""} onValueChange={(v) => set(q.key, v)} className="space-y-1">
                        {q.options?.map((opt: any) => (
                          <div key={opt.value} className="flex items-center gap-2">
                            <RadioGroupItem value={opt.value} id={`preview-${q.key}-${opt.value}`} />
                            <Label htmlFor={`preview-${q.key}-${opt.value}`} className="font-normal cursor-pointer text-sm">{opt.label}</Label>
                            <span className="text-[10px] text-muted-foreground">({opt.points ?? 0}pts)</span>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ── Shell Step Config (Steps 2-9) ── */
function ShellStepConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const items = config.items || [];

  const addItem = () => onChange({ ...config, items: [...items, "Novo item"] });
  const removeItem = (idx: number) => onChange({ ...config, items: items.filter((_: any, i: number) => i !== idx) });
  const updateItem = (idx: number, val: string) => {
    const updated = [...items];
    updated[idx] = val;
    onChange({ ...config, items: updated });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Título</Label>
          <Input value={config.title || ""} onChange={(e) => onChange({ ...config, title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ícone</Label>
          <Input value={config.icon || ""} onChange={(e) => onChange({ ...config, icon: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Descrição</Label>
        <Textarea value={config.description || ""} onChange={(e) => onChange({ ...config, description: e.target.value })} rows={2} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">Itens</Label>
          <Button size="sm" variant="ghost" onClick={addItem} className="text-xs h-7"><Plus size={12} className="mr-1" /> Item</Button>
        </div>
        {items.map((item: string, idx: number) => (
          <div key={idx} className="flex items-center gap-2 mb-1">
            <Input value={item} onChange={(e) => updateItem(idx, e.target.value)} className="h-8 text-sm" />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeItem(idx)}><Trash2 size={12} className="text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 10 Config: Dimensions + Thresholds ── */
function Step10Config({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const dimensions = config.dimensions || [];
  const thresholds = config.thresholds || [];

  const updateDimension = (idx: number, field: string, value: any) => {
    const updated = [...dimensions];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...config, dimensions: updated });
  };

  const addDimension = () => {
    onChange({
      ...config,
      dimensions: [...dimensions, { key: `dim_${Date.now()}`, label: "Nova Dimensão", icon: "Target", color: "text-primary", steps: [] }],
    });
  };

  const removeDimension = (idx: number) => {
    onChange({ ...config, dimensions: dimensions.filter((_: any, i: number) => i !== idx) });
  };

  const updateThreshold = (idx: number, field: string, value: any) => {
    const updated = [...thresholds];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...config, thresholds: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Dimensões do Score</Label>
          <Button size="sm" variant="outline" onClick={addDimension}><Plus size={14} className="mr-1" /> Dimensão</Button>
        </div>
        <div className="space-y-2">
          {dimensions.map((dim: any, idx: number) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_100px_120px_32px] gap-2 items-center">
              <Input value={dim.label} onChange={(e) => updateDimension(idx, "label", e.target.value)} placeholder="Label" className="h-8 text-sm" />
              <Input value={dim.icon} onChange={(e) => updateDimension(idx, "icon", e.target.value)} placeholder="Ícone" className="h-8 text-sm" />
              <Input value={dim.color} onChange={(e) => updateDimension(idx, "color", e.target.value)} placeholder="Cor" className="h-8 text-sm" />
              <Input
                value={(dim.steps || []).join(",")}
                onChange={(e) => updateDimension(idx, "steps", e.target.value.split(",").map(Number).filter(Boolean))}
                placeholder="Steps (ex: 1,4)"
                className="h-8 text-sm"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeDimension(idx)}><Trash2 size={12} className="text-destructive" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold mb-3 block">Thresholds de Classificação</Label>
        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground mb-1">
          <span>Label</span><span>Min %</span>
        </div>
        {thresholds.map((t: any, idx: number) => (
          <div key={idx} className="grid grid-cols-2 gap-2 mb-1">
            <Input value={t.label} onChange={(e) => updateThreshold(idx, "label", e.target.value)} className="h-8 text-sm" />
            <Input type="number" value={t.min_pct} onChange={(e) => updateThreshold(idx, "min_pct", Number(e.target.value))} className="h-8 text-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
