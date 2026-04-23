/**
 * Simulador de Banco de Horas — DPFolha.
 *
 * Permite ao operador inserir horas/dias de banco de horas (ou folgas
 * concedidas) e visualizar, antes de salvar, como esses ajustes
 * impactam:
 *   • Dias úteis efetivos por colaborador
 *   • Vale Transporte (vt_diario × dias úteis)
 *   • Vale Alimentação / benefícios "por_dia" (valor diário × dias úteis)
 *
 * Fonte da verdade (princípio CFO-first): o cálculo segue a hierarquia
 * `resolveBusinessDays` — override individual > override mensal > automático
 * seg-sex. A simulação aplica o ajuste do banco de horas SOBRE o ponto de
 * partida atual (override individual existente, override mensal ou auto).
 *
 * Convenção: 1 dia útil = 8 horas (parametrizável). Horas/dias do banco
 * são SUBTRAÍDOS dos dias úteis efetivos. Valores negativos (horas extras)
 * podem ser informados para somar dias ao mês — limitado pelo teto seg–sex.
 *
 * Após simular, o operador pode aplicar a folha inteira (gera overrides
 * individuais para todos os colaboradores marcados) ou descartar.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Calculator, RotateCcw, Save, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmployees } from "@/hooks/useDP";
import { useDPBenefits, useEmployeeBenefits } from "@/hooks/useDPBenefits";
import {
  resolveBusinessDays,
  useBusinessDayOverrides,
  usePayrollDayOverrides,
  useMutatePayrollDayOverride,
  validateBusinessDays,
} from "@/hooks/useBusinessDays";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRunId: string;
  referenceMonth: string; // yyyy-MM-dd
};

type Mode = "horas" | "dias";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PayrollBankHoursSimulator({
  open, onOpenChange, payrollRunId, referenceMonth,
}: Props) {
  const { toast } = useToast();
  const { data: employees = [] } = useEmployees();
  const { data: monthlyOverrides = [] } = useBusinessDayOverrides();
  const { data: empOverrides = [] } = usePayrollDayOverrides(payrollRunId);
  const { data: benefits = [] } = useBenefits();
  const { data: empBenefitsRaw = [] } = useEmployeeBenefits();
  const { upsert } = useMutatePayrollDayOverride();

  const monthLabel = useMemo(
    () => format(new Date(referenceMonth), "MMMM/yyyy", { locale: ptBR }),
    [referenceMonth],
  );

  const standard = useMemo(
    () => resolveBusinessDays(referenceMonth, monthlyOverrides, null),
    [referenceMonth, monthlyOverrides],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e: any) => e.status === "ativo"),
    [employees],
  );

  // Benefícios "por_dia" por colaborador: valor diário a aplicar
  const perDayByEmp = useMemo(() => {
    const map = new Map<string, number>();
    for (const eb of empBenefitsRaw as any[]) {
      if (!eb.active) continue;
      const b = eb.dp_benefits;
      if (!b || b.type !== "por_dia") continue;
      const valor = Number(eb.custom_value ?? b.default_value ?? 0);
      map.set(eb.employee_id, (map.get(eb.employee_id) ?? 0) + valor);
    }
    return map;
  }, [empBenefitsRaw]);

  // Override individual já salvo (ponto de partida)
  const overrideByEmp = useMemo(() => {
    const m = new Map<string, { days: number; reason: string | null }>();
    for (const o of empOverrides) {
      m.set(o.employee_id, { days: o.business_days_used, reason: o.reason });
    }
    return m;
  }, [empOverrides]);

  // ===== Parâmetros globais da simulação =====
  const [mode, setMode] = useState<Mode>("horas");
  const [hoursPerDay, setHoursPerDay] = useState<string>("8");
  const [globalAmount, setGlobalAmount] = useState<string>(""); // valor padrão para "Aplicar a todos"
  const [globalReason, setGlobalReason] = useState<string>("Banco de horas concedido");

  // Estado da simulação por colaborador
  // amount = quantidade de horas (mode=horas) OU dias (mode=dias) a SUBTRAIR
  type Draft = { selected: boolean; amount: string; reason: string };
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    if (open) {
      // Reseta com seleção padrão = todos os ativos
      const initial: Record<string, Draft> = {};
      for (const emp of activeEmployees) {
        initial[emp.id] = { selected: true, amount: "", reason: "" };
      }
      setDrafts(initial);
      setGlobalAmount("");
      setGlobalReason("Banco de horas concedido");
    }
  }, [open, payrollRunId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hpd = Math.max(1, Number(hoursPerDay) || 8);

  // Converte amount (string) → dias a subtrair
  const toDaysDelta = (raw: string): number => {
    const n = Number(raw);
    if (!raw || Number.isNaN(n)) return 0;
    if (mode === "dias") return n;
    return n / hpd;
  };

  // Calcula resultado por colaborador
  type RowCalc = {
    emp: any;
    baseDays: number;
    baseSource: "individual" | "monthly" | "auto";
    deltaDays: number;
    effectiveDays: number;
    capped: boolean;
    vtBase: number;
    vtSimulated: number;
    vaBase: number;
    vaSimulated: number;
    validation: ReturnType<typeof validateBusinessDays>;
    reason: string;
  };

  const rows: RowCalc[] = useMemo(() => {
    return activeEmployees.map((emp: any) => {
      const existing = overrideByEmp.get(emp.id) ?? null;
      const base = resolveBusinessDays(
        referenceMonth,
        monthlyOverrides,
        existing
          ? {
              id: "",
              payroll_run_id: payrollRunId,
              employee_id: emp.id,
              organization_id: "",
              business_days_used: existing.days,
              reason: existing.reason,
            }
          : null,
      );
      const draft = drafts[emp.id] ?? { selected: false, amount: "", reason: "" };
      const deltaDays = toDaysDelta(draft.amount);
      const raw = base.days - deltaDays;
      // arredonda para inteiro (folha trabalha com inteiros)
      let effectiveDays = Math.round(raw);
      // teto seg-sex e piso 0
      const max = standard.days; // teto absoluto do mês
      const capped = effectiveDays > max || effectiveDays < 0;
      effectiveDays = Math.max(0, Math.min(effectiveDays, max));

      const vtDiario = Number(emp.vt_diario || 0);
      const vaDiario = perDayByEmp.get(emp.id) ?? 0;
      const reason = (draft.reason || globalReason || "").trim();

      const validation = validateBusinessDays(referenceMonth, effectiveDays, reason);

      return {
        emp,
        baseDays: base.days,
        baseSource: base.source,
        deltaDays,
        effectiveDays,
        capped,
        vtBase: vtDiario * base.days,
        vtSimulated: vtDiario * effectiveDays,
        vaBase: vaDiario * base.days,
        vaSimulated: vaDiario * effectiveDays,
        validation,
        reason,
      };
    });
  }, [
    activeEmployees, overrideByEmp, drafts, mode, hpd, referenceMonth,
    monthlyOverrides, payrollRunId, standard.days, perDayByEmp, globalReason,
  ]);

  // Totais
  const totals = useMemo(() => {
    let dDays = 0, dVT = 0, dVA = 0, count = 0;
    for (const r of rows) {
      if (!drafts[r.emp.id]?.selected) continue;
      if (r.deltaDays === 0 && r.effectiveDays === r.baseDays) continue;
      count += 1;
      dDays += r.effectiveDays - r.baseDays;
      dVT += r.vtSimulated - r.vtBase;
      dVA += r.vaSimulated - r.vaBase;
    }
    return { dDays, dVT, dVA, count };
  }, [rows, drafts]);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { selected: true, amount: "", reason: "" }), ...patch } }));

  const handleApplyToAll = () => {
    const amount = globalAmount;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const emp of activeEmployees) {
        const cur = next[emp.id] ?? { selected: true, amount: "", reason: "" };
        if (cur.selected) next[emp.id] = { ...cur, amount };
      }
      return next;
    });
  };

  const handleClearAll = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) next[id] = { ...next[id], amount: "" };
      return next;
    });
    setGlobalAmount("");
  };

  const handleApply = () => {
    const eligible = rows.filter(
      (r) => drafts[r.emp.id]?.selected && r.effectiveDays !== r.baseDays,
    );
    if (eligible.length === 0) {
      toast({
        title: "Nada a aplicar",
        description: "Nenhum colaborador selecionado com alteração efetiva.",
      });
      return;
    }
    const blockers = eligible.filter((r) => r.validation.error);
    if (blockers.length > 0) {
      toast({
        title: "Existem erros",
        description: `${blockers.length} colaborador(es) com valores inválidos. Corrija antes de aplicar.`,
        variant: "destructive",
      });
      return;
    }
    let okCount = 0;
    let pending = eligible.length;
    let firstError: string | undefined;
    eligible.forEach((r) => {
      upsert.mutate(
        {
          payroll_run_id: payrollRunId,
          employee_id: r.emp.id,
          business_days_used: r.effectiveDays,
          reason: r.reason || null,
        },
        {
          onSuccess: () => {
            okCount += 1;
            pending -= 1;
            if (pending === 0) finalize();
          },
          onError: (e: any) => {
            firstError = firstError ?? e?.message;
            pending -= 1;
            if (pending === 0) finalize();
          },
        },
      );
    });
    function finalize() {
      if (okCount > 0) {
        toast({
          title: `Simulação aplicada (${okCount}/${eligible.length})`,
          description: firstError
            ? `Houve erros: ${firstError}`
            : "Os ajustes foram salvos como override individual da folha.",
          variant: firstError ? "destructive" : undefined,
        });
      } else {
        toast({
          title: "Falha ao aplicar",
          description: firstError ?? "Nenhum ajuste foi salvo.",
          variant: "destructive",
        });
      }
      if (okCount > 0 && !firstError) onOpenChange(false);
    }
  };

  const anyError = rows.some((r) => drafts[r.emp.id]?.selected && r.validation.error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" /> Simulador de Banco de Horas
          </DialogTitle>
          <DialogDescription>
            Folha de <strong className="capitalize">{monthLabel}</strong> · padrão do mês:{" "}
            <strong>{standard.days} dias úteis</strong>{" "}
            <span className="text-muted-foreground">
              ({standard.source === "monthly" ? "calendário da empresa" : "automático seg-sex"})
            </span>.
            Insira horas ou dias de banco a <em>subtrair</em> e veja o impacto em VT e
            Vale Alimentação por dia antes de salvar.
          </DialogDescription>
        </DialogHeader>

        {/* Painel de parâmetros */}
        <div className="grid gap-3 sm:grid-cols-5 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Unidade</label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horas">Horas</SelectItem>
                <SelectItem value="dias">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Horas por dia útil
            </label>
            <Input
              type="number"
              min={1}
              max={24}
              step="0.5"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              className="h-8 font-mono text-xs"
              disabled={mode === "dias"}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Aplicar a todos ({mode})
            </label>
            <Input
              type="number"
              step="0.5"
              placeholder={mode === "horas" ? "Ex.: 8" : "Ex.: 1"}
              value={globalAmount}
              onChange={(e) => setGlobalAmount(e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Motivo padrão
            </label>
            <Input
              value={globalReason}
              onChange={(e) => setGlobalReason(e.target.value)}
              className="h-8 text-xs"
              placeholder="Ex.: Banco de horas concedido em 27/12"
            />
          </div>
          <div className="sm:col-span-5 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleApplyToAll}>
              <Calculator size={12} className="mr-1" /> Aplicar valor a todos selecionados
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleClearAll}>
              <RotateCcw size={12} className="mr-1" /> Zerar simulação
            </Button>
            <span className="text-[11px] text-muted-foreground ml-auto">
              Valores positivos <strong>subtraem</strong> dias; negativos somam (limitado ao teto seg–sex).
            </span>
          </div>
        </div>

        {/* Tabela de simulação */}
        <div className="flex-1 overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center w-20">Base</TableHead>
                <TableHead className="text-center w-28">{mode === "horas" ? "Horas −" : "Dias −"}</TableHead>
                <TableHead className="text-center w-20">Efetivo</TableHead>
                <TableHead className="text-right w-36">VT (base → sim.)</TableHead>
                <TableHead className="text-right w-36">VA por dia (base → sim.)</TableHead>
                <TableHead className="w-44">Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-sm text-muted-foreground">
                    Nenhum colaborador ativo.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const d = drafts[r.emp.id] ?? { selected: false, amount: "", reason: "" };
                  const changed = r.effectiveDays !== r.baseDays || r.deltaDays !== 0;
                  const hasError = !!r.validation.error;
                  const hasWarning = !hasError && !!r.validation.warning;
                  const vaApplicable = (perDayByEmp.get(r.emp.id) ?? 0) > 0;
                  const vtApplicable = Number(r.emp.vt_diario || 0) > 0;
                  return (
                    <TableRow key={r.emp.id} className={d.selected && changed ? "bg-primary/5" : ""}>
                      <TableCell className="align-top">
                        <Checkbox
                          checked={d.selected}
                          onCheckedChange={(v) => setDraft(r.emp.id, { selected: !!v })}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{r.emp.name}</span>
                          {r.baseSource === "individual" && (
                            <Badge variant="outline" className="h-5 text-[10px]">Já ajustado</Badge>
                          )}
                          {r.capped && (
                            <Badge variant="outline" className="h-5 text-[10px] border-warning text-warning">
                              Truncado
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{r.emp.contract_type}</p>
                      </TableCell>
                      <TableCell className="text-center font-mono text-muted-foreground align-top">
                        {r.baseDays}
                      </TableCell>
                      <TableCell className="text-center align-top">
                        <Input
                          type="number"
                          step="0.5"
                          value={d.amount}
                          onChange={(e) => setDraft(r.emp.id, { amount: e.target.value })}
                          className="h-8 w-24 mx-auto text-center font-mono text-xs"
                          placeholder="0"
                          disabled={!d.selected}
                        />
                      </TableCell>
                      <TableCell className="text-center font-mono align-top">
                        <span className={changed ? "font-bold text-foreground" : "text-muted-foreground"}>
                          {r.effectiveDays}
                        </span>
                        {(hasError || hasWarning) && d.selected && (
                          <p className={`mt-1 text-[10px] flex items-start gap-1 justify-center ${hasError ? "text-destructive" : "text-warning"}`}>
                            <AlertTriangle size={10} className="mt-px shrink-0" />
                            <span className="text-left">{hasError ? r.validation.error : r.validation.warning}</span>
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs align-top">
                        {vtApplicable ? (
                          <>
                            <div className="text-muted-foreground">{fmtBRL(r.vtBase)}</div>
                            <div className={changed ? "font-bold text-foreground" : ""}>
                              {fmtBRL(r.vtSimulated)}
                              {changed && (
                                <span className={`ml-1 text-[10px] ${r.vtSimulated < r.vtBase ? "text-destructive" : "text-success"}`}>
                                  ({r.vtSimulated >= r.vtBase ? "+" : ""}{fmtBRL(r.vtSimulated - r.vtBase)})
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs align-top">
                        {vaApplicable ? (
                          <>
                            <div className="text-muted-foreground">{fmtBRL(r.vaBase)}</div>
                            <div className={changed ? "font-bold text-foreground" : ""}>
                              {fmtBRL(r.vaSimulated)}
                              {changed && (
                                <span className={`ml-1 text-[10px] ${r.vaSimulated < r.vaBase ? "text-destructive" : "text-success"}`}>
                                  ({r.vaSimulated >= r.vaBase ? "+" : ""}{fmtBRL(r.vaSimulated - r.vaBase)})
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={d.reason}
                          onChange={(e) => setDraft(r.emp.id, { reason: e.target.value })}
                          placeholder={globalReason || "Motivo individual"}
                          className="h-8 text-xs"
                          disabled={!d.selected}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumo agregado */}
        <div className="grid gap-2 sm:grid-cols-4 text-xs">
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] text-muted-foreground">Colaboradores afetados</p>
            <p className="font-bold text-foreground">{totals.count}</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] text-muted-foreground">Δ Dias úteis (soma)</p>
            <p className={`font-bold ${totals.dDays < 0 ? "text-destructive" : totals.dDays > 0 ? "text-success" : "text-foreground"}`}>
              {totals.dDays > 0 ? "+" : ""}{totals.dDays}
            </p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] text-muted-foreground">Δ VT total</p>
            <p className={`font-bold font-mono ${totals.dVT < 0 ? "text-destructive" : totals.dVT > 0 ? "text-success" : "text-foreground"}`}>
              {totals.dVT >= 0 ? "+" : ""}{fmtBRL(totals.dVT)}
            </p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] text-muted-foreground">Δ VA por dia total</p>
            <p className={`font-bold font-mono ${totals.dVA < 0 ? "text-destructive" : totals.dVA > 0 ? "text-success" : "text-foreground"}`}>
              {totals.dVA >= 0 ? "+" : ""}{fmtBRL(totals.dVA)}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar sem salvar</Button>
          <Button
            onClick={handleApply}
            disabled={upsert.isPending || anyError || totals.count === 0}
          >
            <Save size={14} className="mr-1" />
            Aplicar à folha ({totals.count})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
