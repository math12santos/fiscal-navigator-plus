/**
 * Calendário de Dias Úteis — gestão dos próximos 12 meses.
 *
 * Permite ao operador sobrescrever a quantidade de dias úteis do mês
 * (ex.: descontar pontes, feriados, banco de horas concedido). O cálculo
 * automático usa segunda a sexta como fallback. Toda alteração é registrada
 * com observação opcional, garantindo rastreabilidade contábil.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarDays, RotateCcw, Save, Info, AlertTriangle } from "lucide-react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useBusinessDayOverrides,
  useMutateBusinessDayOverride,
  monthKey,
  validateBusinessDays,
} from "@/hooks/useBusinessDays";
import { getBusinessDays } from "@/hooks/usePayrollProjections";
import { useToast } from "@/hooks/use-toast";

type Row = {
  monthKey: string;
  label: string;
  auto: number;
  effective: number;
  notes: string;
  hasOverride: boolean;
};

export default function DPBusinessDaysCalendar() {
  const { data: overrides = [], isLoading } = useBusinessDayOverrides();
  const { upsert, remove } = useMutateBusinessDayOverride();
  const { toast } = useToast();

  // Próximos 12 meses começando pelo mês corrente
  const baseRows = useMemo<Row[]>(() => {
    const start = startOfMonth(new Date());
    return Array.from({ length: 12 }).map((_, i) => {
      const m = addMonths(start, i);
      const key = monthKey(m);
      const auto = getBusinessDays(m);
      const ov = overrides.find((o) => o.reference_month === key);
      return {
        monthKey: key,
        label: format(m, "MMMM/yyyy", { locale: ptBR }),
        auto,
        effective: ov?.business_days ?? auto,
        notes: ov?.notes ?? "",
        hasOverride: !!ov,
      };
    });
  }, [overrides]);

  // Estado local de edição — só é "salvo" quando o usuário clica em Salvar.
  const [drafts, setDrafts] = useState<Record<string, { days: string; notes: string }>>({});

  const getValue = (r: Row): { days: string; notes: string } =>
    drafts[r.monthKey] ?? { days: String(r.effective), notes: r.notes };

  const setDraft = (key: string, patch: Partial<{ days: string; notes: string }>) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { days: "", notes: "" }), ...patch },
    }));
  };

  const isDirty = (r: Row): boolean => {
    const d = drafts[r.monthKey];
    if (!d) return false;
    const numericDays = Number(d.days);
    if (Number.isNaN(numericDays)) return false;
    return numericDays !== r.effective || (d.notes ?? "") !== (r.notes ?? "");
  };

  const handleSave = (r: Row) => {
    const draft = drafts[r.monthKey];
    if (!draft) return;
    const days = Number(draft.days);
    const validation = validateBusinessDays(r.monthKey, draft.days, draft.notes);
    if (validation.error) {
      toast({
        title: "Quantidade inválida",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }
    upsert.mutate(
      { reference_month: r.monthKey, business_days: days, notes: draft.notes?.trim() || null },
      {
        onSuccess: () => {
          toast({
            title: `Calendário atualizado — ${r.label}`,
            description: validation.warning,
          });
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[r.monthKey];
            return next;
          });
        },
        onError: (e: any) =>
          toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
      },
    );
  };

  const handleReset = (r: Row) => {
    if (!r.hasOverride) {
      // Apenas descarta rascunho local
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[r.monthKey];
        return next;
      });
      return;
    }
    remove.mutate(r.monthKey, {
      onSuccess: () => {
        toast({ title: `Override removido — ${r.label}`, description: "Voltou ao cálculo automático." });
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[r.monthKey];
          return next;
        });
      },
      onError: (e: any) =>
        toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <CalendarDays size={16} className="mt-0.5 text-primary" />
          <div>
            <CardTitle className="text-sm">Calendário de Dias Úteis</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ajuste a quantidade de dias úteis do mês para refletir feriados,
              pontes ou banco de horas concedido coletivamente. O cálculo
              automático considera segunda a sexta-feira. Os valores afetam VT,
              Vale Alimentação por dia e demais benefícios proporcionais ao
              expediente.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Carregando calendário...</div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês de referência</TableHead>
                  <TableHead className="text-center">Automático</TableHead>
                  <TableHead className="text-center w-32">Efetivo</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="w-44 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baseRows.map((r) => {
                  const v = getValue(r);
                  const dirty = isDirty(r);
                  const validation = validateBusinessDays(r.monthKey, v.days, v.notes);
                  const hasError = !!validation.error;
                  const hasWarning = !hasError && !!validation.warning;
                  return (
                    <TableRow key={r.monthKey}>
                      <TableCell className="capitalize">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{r.label}</span>
                          {r.hasOverride && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              Personalizado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-muted-foreground">
                        {r.auto}
                      </TableCell>
                      <TableCell className="text-center align-top">
                        <Input
                          type="number"
                          min={0}
                          max={validation.maxBusinessDays}
                          value={v.days}
                          onChange={(e) => setDraft(r.monthKey, { days: e.target.value })}
                          aria-invalid={hasError}
                          className={`h-8 w-20 mx-auto text-center font-mono ${
                            hasError
                              ? "border-destructive focus-visible:ring-destructive"
                              : hasWarning
                              ? "border-warning focus-visible:ring-warning"
                              : ""
                          }`}
                        />
                        {(hasError || hasWarning) && (
                          <p
                            className={`mt-1 text-[10px] leading-tight flex items-start gap-1 justify-center ${
                              hasError ? "text-destructive" : "text-warning"
                            }`}
                          >
                            <AlertTriangle size={10} className="mt-px shrink-0" />
                            <span className="text-left">
                              {hasError ? validation.error : validation.warning}
                            </span>
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Ex.: ponte de carnaval"
                          value={v.notes}
                          onChange={(e) => setDraft(r.monthKey, { notes: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleReset(r)}
                            disabled={remove.isPending || (!r.hasOverride && !drafts[r.monthKey])}
                            title={r.hasOverride ? "Voltar para o cálculo automático" : "Descartar alterações"}
                          >
                            <RotateCcw size={12} className="mr-1" />
                            {r.hasOverride ? "Limpar" : "Descartar"}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSave(r)}
                            disabled={!dirty || hasError || upsert.isPending}
                          >
                            <Save size={12} className="mr-1" /> Salvar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info size={12} className="mt-0.5 shrink-0" />
          <p>
            Para ajustes pontuais por colaborador (férias parciais, afastamento, banco
            de horas individual), use o botão <strong>"Ajustar dias úteis"</strong> na
            tela de Folha de Pagamento.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
