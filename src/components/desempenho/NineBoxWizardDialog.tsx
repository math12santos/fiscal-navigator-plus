// Wizard focado para criar avaliação 9 Box criteriosa.
// 4 passos colapsáveis (Accordion), sem permitir nota cheia digitada.

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  use9BoxCriteria,
  useMutate9BoxScore,
  useMutate9BoxSource,
  useFinalize9Box,
} from "@/hooks/useNineBoxRubric";
import {
  computeFinalQuadrant,
  confidenceScore,
  DEFAULT_SOURCE_WEIGHTS,
  type CriterionRow,
  type ScoreRow,
  type SourceKind,
  type SourceRow,
} from "@/lib/performance/scoring";
import { QUADRANT_META, QUADRANT_TONE_CLASS } from "@/lib/performance/quadrante";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employees: any[];
  bscList: any[];
  onSaved?: () => void;
}

type DraftScore = {
  criterion_id: string;
  source: SourceKind;
  score: number;
  evidence_text: string;
  evidence_url: string;
};

export function NineBoxWizardDialog({ open, onOpenChange, employees, bscList, onSaved }: Props) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { data: criteria = [] } = use9BoxCriteria();
  const mutateScore = useMutate9BoxScore();
  const mutateSource = useMutate9BoxSource();
  const finalize = useFinalize9Box();

  const [step, setStep] = useState<string>("step-1");
  const [employeeId, setEmployeeId] = useState("");
  const [enableAuto, setEnableAuto] = useState(true);
  const [enablePar, setEnablePar] = useState(false);
  const [parEvaluatorId, setParEvaluatorId] = useState<string>("");
  const [drafts, setDrafts] = useState<DraftScore[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setStep("step-1");
      setEmployeeId("");
      setEnableAuto(true);
      setEnablePar(false);
      setParEvaluatorId("");
      setDrafts([]);
    }
  }, [open]);

  const desempenhoCrit = useMemo(() => criteria.filter((c) => c.dimension === "desempenho"), [criteria]);
  const potencialCrit = useMemo(() => criteria.filter((c) => c.dimension === "potencial"), [criteria]);

  // Sugestão BSC para "Entrega de resultados"
  const suggestedBsc = useMemo(() => {
    if (!employeeId) return null;
    const empBsc = bscList.find((b: any) => b.employee_id === employeeId && b.status === "ativo");
    if (!empBsc) return null;
    const pct = Number(empBsc.resultado_geral);
    const nota = Math.max(1, Math.min(5, Math.round((pct / 100) * 5 * 10) / 10));
    return { bsc: empBsc, nota };
  }, [employeeId, bscList]);

  // Atualiza um draft (cria se não existe)
  const updateDraft = (criterion_id: string, source: SourceKind, patch: Partial<DraftScore>) => {
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.criterion_id === criterion_id && d.source === source);
      if (idx === -1) {
        return [
          ...prev,
          {
            criterion_id,
            source,
            score: 3,
            evidence_text: "",
            evidence_url: "",
            ...patch,
          },
        ];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const getDraft = (criterion_id: string, source: SourceKind): DraftScore =>
    drafts.find((d) => d.criterion_id === criterion_id && d.source === source) ?? {
      criterion_id,
      source,
      score: 3,
      evidence_text: "",
      evidence_url: "",
    };

  // Auto-aplica sugestão BSC ao critério "Entrega de resultados" do gestor
  useEffect(() => {
    if (!suggestedBsc) return;
    const entrega = desempenhoCrit.find((c) => /entrega/i.test(c.name));
    if (!entrega) return;
    const cur = drafts.find((d) => d.criterion_id === entrega.id && d.source === "gestor");
    if (cur) return;
    updateDraft(entrega.id, "gestor", {
      score: suggestedBsc.nota,
      evidence_text: `BSC "${suggestedBsc.bsc.nome}" — atingimento ${Math.round(Number(suggestedBsc.bsc.resultado_geral))}%.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedBsc, desempenhoCrit.length]);

  // Sources e scoring real para preview
  const sourcesPreview: SourceRow[] = useMemo(
    () => [
      { source: "gestor", weight: DEFAULT_SOURCE_WEIGHTS.gestor, submitted: true },
      { source: "auto", weight: DEFAULT_SOURCE_WEIGHTS.auto, submitted: enableAuto },
      { source: "par", weight: DEFAULT_SOURCE_WEIGHTS.par, submitted: enablePar },
    ],
    [enableAuto, enablePar],
  );

  // Para o cálculo do quadrante, considera apenas as notas do gestor (fontes externas serão preenchidas depois)
  const gestorScores: ScoreRow[] = useMemo(
    () =>
      drafts
        .filter((d) => d.source === "gestor")
        .map((d) => ({
          criterion_id: d.criterion_id,
          source: "gestor",
          score: d.score,
          evidence_text: d.evidence_text,
          evidence_url: d.evidence_url,
        })),
    [drafts],
  );

  const preview = useMemo(
    () =>
      computeFinalQuadrant(
        criteria,
        gestorScores,
        [{ source: "gestor", weight: 100, submitted: true }],
      ),
    [criteria, gestorScores],
  );

  const conf = useMemo(
    () => confidenceScore(criteria, gestorScores, sourcesPreview),
    [criteria, gestorScores, sourcesPreview],
  );

  // Validações
  function missingEvidence(scope: "desempenho" | "potencial"): CriterionRow[] {
    const list = scope === "desempenho" ? desempenhoCrit : potencialCrit;
    return list.filter((c) => {
      const d = drafts.find((x) => x.criterion_id === c.id && x.source === "gestor");
      if (!d) return false;
      if (d.score >= 4 || d.score <= 2) {
        return !(d.evidence_text.trim() || d.evidence_url.trim());
      }
      return false;
    });
  }

  const allDesempenhoFilled = desempenhoCrit.every((c) =>
    drafts.find((d) => d.criterion_id === c.id && d.source === "gestor"),
  );
  const allPotencialFilled = potencialCrit.every((c) =>
    drafts.find((d) => d.criterion_id === c.id && d.source === "gestor"),
  );

  async function handleSave() {
    if (!employeeId) return toast.error("Selecione o colaborador.");
    if (!allDesempenhoFilled || !allPotencialFilled)
      return toast.error("Avalie todos os critérios da rubrica.");
    const missing = [...missingEvidence("desempenho"), ...missingEvidence("potencial")];
    if (missing.length > 0)
      return toast.error(`Evidência obrigatória nos critérios: ${missing.map((m) => m.name).join(", ")}.`);
    if (!preview.notaDes || !preview.notaPot) return toast.error("Não foi possível calcular o quadrante.");

    setSaving(true);
    try {
      // 1) cria a avaliação base (rascunho)
      const { data: ev, error: e0 } = await supabase
        .from("hr_9box_evaluations" as any)
        .insert({
          employee_id: employeeId,
          organization_id: currentOrg!.id,
          user_id: user!.id,
          evaluator_user_id: user!.id,
          nota_desempenho: preview.notaDes,
          nota_potencial: preview.notaPot,
          confiabilidade: conf,
          status: "rascunho",
          bsc_score_snapshot: suggestedBsc?.bsc?.resultado_geral ?? null,
        } as any)
        .select()
        .single();
      if (e0) throw e0;
      const evaluation_id = (ev as any).id as string;

      // 2) registra fontes
      await mutateSource.mutateAsync({
        evaluation_id,
        source: "gestor",
        weight: DEFAULT_SOURCE_WEIGHTS.gestor,
        submitted: true,
        evaluator_user_id: user!.id,
      });
      if (enableAuto) {
        await mutateSource.mutateAsync({
          evaluation_id,
          source: "auto",
          weight: DEFAULT_SOURCE_WEIGHTS.auto,
          submitted: false,
          evaluator_user_id: null,
        });
      }
      if (enablePar) {
        await mutateSource.mutateAsync({
          evaluation_id,
          source: "par",
          weight: DEFAULT_SOURCE_WEIGHTS.par,
          submitted: false,
          evaluator_user_id: parEvaluatorId || null,
        });
      }

      // 3) grava todas as notas do gestor
      for (const d of drafts.filter((x) => x.source === "gestor")) {
        await mutateScore.mutateAsync({
          evaluation_id,
          criterion_id: d.criterion_id,
          source: "gestor",
          score: d.score,
          evidence_text: d.evidence_text || null,
          evidence_url: d.evidence_url || null,
        });
      }

      // 4) muda para em_calibracao
      await finalize.mutateAsync({
        id: evaluation_id,
        nota_desempenho: preview.notaDes,
        nota_potencial: preview.notaPot,
        confiabilidade: conf,
        status: "em_calibracao",
        action: "criada_e_enviada_para_calibracao",
      });

      toast.success("Avaliação enviada para calibração.");
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  const previewMeta = preview.quadrante ? QUADRANT_META[preview.quadrante] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova avaliação 9 Box criteriosa</DialogTitle>
          <DialogDescription>
            A nota final é calculada a partir de critérios ponderados com âncoras e evidências —
            não digitada diretamente.
          </DialogDescription>
        </DialogHeader>

        <Accordion type="single" collapsible value={step} onValueChange={setStep} className="w-full">
          {/* PASSO 1 — Colaborador e fontes */}
          <AccordionItem value="step-1">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="outline">1</Badge> Colaborador e fontes
                {employeeId && <CheckCircle2 size={14} className="text-emerald-600" />}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div>
                <Label>Colaborador *</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Card className="border-border">
                <CardContent className="pt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Auto-avaliação do colaborador</Label>
                      <p className="text-xs text-muted-foreground">Peso 20% • envio posterior pelo colaborador</p>
                    </div>
                    <Switch checked={enableAuto} onCheckedChange={setEnableAuto} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Par / skip-level</Label>
                      <p className="text-xs text-muted-foreground">Peso 20% • envio posterior pelo par</p>
                    </div>
                    <Switch checked={enablePar} onCheckedChange={setEnablePar} />
                  </div>
                  {enablePar && (
                    <div>
                      <Label className="text-xs">Par avaliador (opcional)</Label>
                      <Select value={parEvaluatorId} onValueChange={setParEvaluatorId}>
                        <SelectTrigger><SelectValue placeholder="Selecione um par" /></SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter((e: any) => e.id !== employeeId && e.user_id)
                            .map((e: any) => (
                              <SelectItem key={e.user_id} value={e.user_id}>{e.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="rounded-md bg-muted/40 p-2 text-xs flex gap-2 items-start">
                    <Info size={14} className="text-muted-foreground mt-0.5" />
                    <p>Você (gestor) avalia agora. As demais fontes recebem convite e enviam depois — a nota final consolidada considerará todas.</p>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button size="sm" disabled={!employeeId} onClick={() => setStep("step-2")}>Continuar</Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* PASSO 2 — Desempenho */}
          <AccordionItem value="step-2">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="outline">2</Badge> Avaliar desempenho ({desempenhoCrit.length} critérios)
                {allDesempenhoFilled && <CheckCircle2 size={14} className="text-emerald-600" />}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {desempenhoCrit.map((c) => (
                <CriterionEditor
                  key={c.id}
                  criterion={c}
                  draft={getDraft(c.id, "gestor")}
                  onChange={(p) => updateDraft(c.id, "gestor", p)}
                />
              ))}
              <div className="flex justify-end">
                <Button size="sm" disabled={!allDesempenhoFilled} onClick={() => setStep("step-3")}>Continuar</Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* PASSO 3 — Potencial */}
          <AccordionItem value="step-3">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="outline">3</Badge> Avaliar potencial ({potencialCrit.length} critérios)
                {allPotencialFilled && <CheckCircle2 size={14} className="text-emerald-600" />}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {potencialCrit.map((c) => (
                <CriterionEditor
                  key={c.id}
                  criterion={c}
                  draft={getDraft(c.id, "gestor")}
                  onChange={(p) => updateDraft(c.id, "gestor", p)}
                />
              ))}
              <div className="flex justify-end">
                <Button size="sm" disabled={!allPotencialFilled} onClick={() => setStep("step-4")}>Revisar</Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* PASSO 4 — Revisão */}
          <AccordionItem value="step-4">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="outline">4</Badge> Revisão e envio para calibração
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {previewMeta ? (
                <div className={`rounded-md border p-3 ${QUADRANT_TONE_CLASS[previewMeta.tone]}`}>
                  <p className="text-sm font-semibold">
                    Quadrante {preview.quadrante} · {previewMeta.label}
                  </p>
                  <p className="text-xs mt-1">{previewMeta.description}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                    <Stat label="Desempenho" value={preview.notaDes?.toFixed(1) ?? "—"} />
                    <Stat label="Potencial" value={preview.notaPot?.toFixed(1) ?? "—"} />
                    <Stat label="Confiabilidade" value={`${conf}%`} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Preencha os critérios para visualizar o quadrante.</p>
              )}

              {(missingEvidence("desempenho").length > 0 || missingEvidence("potencial").length > 0) && (
                <div className="flex gap-2 items-start text-xs text-destructive bg-destructive/10 p-2 rounded">
                  <AlertCircle size={14} className="mt-0.5" />
                  <p>Critérios com nota extrema (≤2 ou ≥4) precisam de evidência antes de salvar.</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Ao salvar, a avaliação vai para <strong>calibração</strong>. Ela <strong>não fica visível ao colaborador</strong>.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar e enviar para calibração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-background/60 p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CriterionEditor({
  criterion,
  draft,
  onChange,
}: {
  criterion: CriterionRow;
  draft: DraftScore;
  onChange: (p: Partial<DraftScore>) => void;
}) {
  const anchors = [criterion.anchor_1, criterion.anchor_2, criterion.anchor_3, criterion.anchor_4, criterion.anchor_5];
  const currentAnchor = anchors[Math.round(draft.score) - 1];
  const isExtreme = draft.score <= 2 || draft.score >= 4;
  const noEvidence = !(draft.evidence_text?.trim() || draft.evidence_url?.trim());

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex justify-between items-baseline">
          <Label className="text-sm font-semibold">{criterion.name}</Label>
          <Badge variant="outline" className="text-[10px]">peso {Number(criterion.weight)}%</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            min={1}
            max={5}
            step={0.5}
            value={[draft.score]}
            onValueChange={([v]) => onChange({ score: v })}
            className="flex-1"
          />
          <span className="text-sm font-mono w-10 text-right">{draft.score.toFixed(1)}</span>
        </div>
        {currentAnchor && (
          <p className="text-xs text-muted-foreground italic">"{currentAnchor}"</p>
        )}
        {isExtreme && (
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              Evidência {noEvidence && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              rows={2}
              placeholder="Fato observável, exemplo, métrica…"
              value={draft.evidence_text}
              onChange={(e) => onChange({ evidence_text: e.target.value })}
              className={noEvidence ? "border-destructive/50" : ""}
            />
            <Input
              placeholder="Link para evidência (opcional)"
              value={draft.evidence_url}
              onChange={(e) => onChange({ evidence_url: e.target.value })}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
