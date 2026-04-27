// Dialog de edição das metas de maturidade do setor.
// Usa apenas os campos relevantes ao setor selecionado.

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Save } from "lucide-react";
import { useSectorMaturityTargets } from "@/hooks/useSectorMaturityTargets";
import { SectorKey, SECTOR_META } from "@/lib/sectorMaturity/types";
import { fieldsForSector, SectorMaturityTargets } from "@/lib/sectorMaturity/targets";
import { Separator } from "@/components/ui/separator";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sector: SectorKey;
  orgIdOverride?: string; // backoffice context
}

export function SectorMaturityTargetsDialog({ open, onOpenChange, sector, orgIdOverride }: Props) {
  const { targets, defaults, hasCustomTargets, isLoading, upsertAsync, isSaving, reset, isResetting } =
    useSectorMaturityTargets(sector, orgIdOverride);
  const [draft, setDraft] = useState<SectorMaturityTargets>(targets);
  const fields = fieldsForSector(sector);

  useEffect(() => {
    if (open) setDraft(targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(targets)]);

  const set = <K extends keyof SectorMaturityTargets>(k: K, v: SectorMaturityTargets[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    await upsertAsync(draft);
    onOpenChange(false);
  };

  const restore = (k: keyof SectorMaturityTargets) => set(k, defaults[k] as any);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Metas de maturidade
            <Badge variant="outline">{SECTOR_META[sector].label}</Badge>
            {hasCustomTargets ? (
              <Badge className="bg-primary/10 text-primary border-primary/20">Personalizado</Badge>
            ) : (
              <Badge variant="outline">Padrão</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Ajuste os limites usados pelo termômetro deste setor. Valores fora do intervalo voltam ao padrão automaticamente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6">Carregando metas…</p>
        ) : (
          <div className="space-y-5 py-2">
            {fields.includes("routines_target_pct") && (
              <PctField
                label="Meta de cumprimento de rotinas"
                hint="Percentual mínimo de rotinas/solicitações concluídas no mês."
                value={draft.routines_target_pct}
                defaultValue={defaults.routines_target_pct}
                onChange={(v) => set("routines_target_pct", v)}
                onRestore={() => restore("routines_target_pct")}
              />
            )}

            {fields.includes("routines_overdue_tolerance_pct") && (
              <PctField
                label="Tolerância de atraso em rotinas"
                hint="Fração de atrasados absorvida antes de penalizar a nota."
                value={draft.routines_overdue_tolerance_pct}
                defaultValue={defaults.routines_overdue_tolerance_pct}
                onChange={(v) => set("routines_overdue_tolerance_pct", v)}
                onRestore={() => restore("routines_overdue_tolerance_pct")}
              />
            )}

            {fields.includes("reconciliation_target_pct") && (
              <PctField
                label="Meta de conciliação financeira"
                hint="Percentual mínimo de lançamentos do mês anterior marcados como realizados."
                value={draft.reconciliation_target_pct}
                defaultValue={defaults.reconciliation_target_pct}
                onChange={(v) => set("reconciliation_target_pct", v)}
                onRestore={() => restore("reconciliation_target_pct")}
              />
            )}

            {fields.includes("classification_target_pct") && (
              <PctField
                label="Meta de classificação de lançamentos"
                hint="Percentual mínimo de lançamentos do mês com conta contábil + centro de custo."
                value={draft.classification_target_pct}
                defaultValue={defaults.classification_target_pct}
                onChange={(v) => set("classification_target_pct", v)}
                onRestore={() => restore("classification_target_pct")}
              />
            )}

            {fields.includes("bank_freshness_days") && (
              <IntField
                label="Frescor dos saldos bancários"
                suffix="dias"
                hint="Saldo considerado fresco se atualizado nos últimos N dias."
                value={draft.bank_freshness_days}
                defaultValue={defaults.bank_freshness_days}
                min={1}
                max={90}
                onChange={(v) => set("bank_freshness_days", v)}
                onRestore={() => restore("bank_freshness_days")}
              />
            )}

            {fields.includes("overdue_critical_days") && (
              <IntField
                label="Vencido crítico a partir de"
                suffix="dias"
                hint="Lançamento previsto não pago após N dias é tratado como crítico."
                value={draft.overdue_critical_days}
                defaultValue={defaults.overdue_critical_days}
                min={1}
                max={365}
                onChange={(v) => set("overdue_critical_days", v)}
                onRestore={() => restore("overdue_critical_days")}
              />
            )}

            {fields.includes("overdue_max_count") && (
              <IntField
                label="Vencidos críticos que zeram a nota"
                suffix="lançamentos"
                hint="Quantidade de vencidos críticos que penaliza 100% da nota dessa rubrica."
                value={draft.overdue_max_count}
                defaultValue={defaults.overdue_max_count}
                min={1}
                max={1000}
                onChange={(v) => set("overdue_max_count", v)}
                onRestore={() => restore("overdue_max_count")}
              />
            )}

            {fields.includes("documents_required") && (
              <DocsField
                value={draft.documents_required}
                defaultValue={defaults.documents_required}
                onChange={(v) => set("documents_required", v)}
                onRestore={() => restore("documents_required")}
              />
            )}

            {fields.includes("payroll_close_required") && (
              <BoolField
                label="Exigir folha do mês anterior fechada"
                hint="Se desativado, o item de fechamento da folha deixa de penalizar a nota."
                value={draft.payroll_close_required}
                defaultValue={defaults.payroll_close_required}
                onChange={(v) => set("payroll_close_required", v)}
                onRestore={() => restore("payroll_close_required")}
              />
            )}

            {fields.includes("period_close_required") && (
              <BoolField
                label="Exigir período fiscal anterior fechado"
                hint="Se desativado, o item de fechamento do período deixa de penalizar a nota."
                value={draft.period_close_required}
                defaultValue={defaults.period_close_required}
                onChange={(v) => set("period_close_required", v)}
                onRestore={() => restore("period_close_required")}
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => reset()}
            disabled={!hasCustomTargets || isResetting}
            title="Apaga o registro e volta a usar os padrões"
          >
            <RotateCcw size={14} className="mr-1.5" />
            Restaurar padrões
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} disabled={isSaving}>
              <Save size={14} className="mr-1.5" />
              {isSaving ? "Salvando…" : "Salvar metas"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PctField(props: {
  label: string; hint?: string; value: number; defaultValue: number;
  onChange: (v: number) => void; onRestore: () => void;
}) {
  const { label, hint, value, defaultValue, onChange, onRestore } = props;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        <button type="button" onClick={onRestore} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
          padrão {Math.round(defaultValue * 100)}%
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={Math.round(value * 100)}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)) / 100);
          }}
          className="w-28"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      <Separator className="mt-3" />
    </div>
  );
}

function IntField(props: {
  label: string; suffix?: string; hint?: string;
  value: number; defaultValue: number; min: number; max: number;
  onChange: (v: number) => void; onRestore: () => void;
}) {
  const { label, suffix, hint, value, defaultValue, min, max, onChange, onRestore } = props;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        <button type="button" onClick={onRestore} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
          padrão {defaultValue} {suffix ?? ""}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            onChange(Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)));
          }}
          className="w-28"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      <Separator className="mt-3" />
    </div>
  );
}

function BoolField(props: {
  label: string; hint?: string; value: boolean; defaultValue: boolean;
  onChange: (v: boolean) => void; onRestore: () => void;
}) {
  const { label, hint, value, defaultValue, onChange, onRestore } = props;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        <button type="button" onClick={onRestore} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
          padrão {defaultValue ? "ativo" : "desativado"}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={value} onCheckedChange={onChange} />
        <span className="text-sm text-muted-foreground">{value ? "Exigido" : "Não exigido"}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      <Separator className="mt-3" />
    </div>
  );
}

function DocsField(props: {
  value: string[]; defaultValue: string[];
  onChange: (v: string[]) => void; onRestore: () => void;
}) {
  const { value, defaultValue, onChange, onRestore } = props;
  const [text, setText] = useState(value.join(", "));
  useEffect(() => { setText(value.join(", ")); }, [value]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm font-medium">Documentos obrigatórios por colaborador</Label>
        <button type="button" onClick={onRestore} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
          padrão {defaultValue.join(", ")}
        </button>
      </div>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = text.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
          onChange(parsed.length ? parsed : defaultValue);
        }}
        placeholder="contrato, rg, cpf"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Lista separada por vírgula. Cada item corresponde ao tipo de documento (doc_type) do colaborador.
      </p>
      <Separator className="mt-3" />
    </div>
  );
}
