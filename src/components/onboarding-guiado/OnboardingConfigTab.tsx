import { useState, useEffect } from "react";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STEP_NAMES = [
  "", "Diagnóstico", "Estrutura", "Integrações", "Financeiro", "Contratos",
  "Planejamento", "Rotinas", "Cockpit", "Assistida", "Score",
];

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
  );
}

/* ── Step 1 Config: Sections + Questions + Thresholds ── */
function Step1Config({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const sections = config.sections || [];
  const thresholds = config.thresholds || [];

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

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Seções do Questionário</Label>
          <Button size="sm" variant="outline" onClick={addSection}><Plus size={14} className="mr-1" /> Seção</Button>
        </div>
        <div className="space-y-4">
          {sections.map((section: any, sIdx: number) => (
            <Card key={sIdx} className="border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input value={section.label} onChange={(e) => updateSection(sIdx, { ...section, label: e.target.value })} placeholder="Nome da seção" className="flex-1" />
                  <Input value={section.icon} onChange={(e) => updateSection(sIdx, { ...section, icon: e.target.value })} placeholder="Ícone" className="w-32" />
                  <Button size="icon" variant="ghost" onClick={() => removeSection(sIdx)}><Trash2 size={14} className="text-destructive" /></Button>
                </div>
                <QuestionsEditor
                  questions={section.questions || []}
                  onChange={(qs) => updateSection(sIdx, { ...section, questions: qs })}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold mb-3 block">Thresholds de Maturidade</Label>
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground mb-1">
          <span>Nível</span><span>Label</span><span>Min</span><span>Max</span>
        </div>
        {thresholds.map((t: any, idx: number) => (
          <div key={idx} className="grid grid-cols-4 gap-2 mb-1">
            <Input value={t.level} disabled className="h-8 text-sm" />
            <Input value={t.label} onChange={(e) => updateThreshold(idx, "label", e.target.value)} className="h-8 text-sm" />
            <Input type="number" value={t.min_score} onChange={(e) => updateThreshold(idx, "min_score", Number(e.target.value))} className="h-8 text-sm" />
            <Input type="number" value={t.max_score} onChange={(e) => updateThreshold(idx, "max_score", Number(e.target.value))} className="h-8 text-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Questions Editor ── */
function QuestionsEditor({ questions, onChange }: { questions: any[]; onChange: (qs: any[]) => void }) {
  const addQuestion = () => {
    onChange([...questions, { key: `q_${Date.now()}`, label: "Nova pergunta", options: [] }]);
  };

  const removeQuestion = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, q: any) => {
    const updated = [...questions];
    updated[idx] = q;
    onChange(updated);
  };

  return (
    <div className="space-y-3 pl-4 border-l-2 border-muted">
      {questions.map((q: any, qIdx: number) => (
        <div key={qIdx} className="space-y-2">
          <div className="flex items-center gap-2">
            <Input value={q.label} onChange={(e) => updateQuestion(qIdx, { ...q, label: e.target.value })} placeholder="Pergunta" className="flex-1 text-sm h-8" />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeQuestion(qIdx)}><Trash2 size={12} className="text-destructive" /></Button>
          </div>
          <OptionsEditor
            options={q.options || []}
            onChange={(opts) => updateQuestion(qIdx, { ...q, options: opts })}
          />
        </div>
      ))}
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
    <div className="space-y-1 pl-4">
      <div className="grid grid-cols-[1fr_80px_32px] gap-1 text-xs text-muted-foreground">
        <span>Opção</span><span>Pontos</span><span></span>
      </div>
      {options.map((opt: any, idx: number) => (
        <div key={idx} className="grid grid-cols-[1fr_80px_32px] gap-1">
          <Input value={opt.label} onChange={(e) => updateOption(idx, "label", e.target.value)} className="h-7 text-xs" />
          <Input type="number" value={opt.points} onChange={(e) => updateOption(idx, "points", Number(e.target.value))} className="h-7 text-xs" />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeOption(idx)}><Trash2 size={10} className="text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={addOption} className="text-xs h-6"><Plus size={10} className="mr-1" /> Opção</Button>
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
