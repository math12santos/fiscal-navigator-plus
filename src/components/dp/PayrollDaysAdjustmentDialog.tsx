/**
 * Diálogo para ajuste pontual de dias úteis por colaborador dentro de uma
 * rodada de folha. Usado para tratar férias parciais, afastamentos, banco
 * de horas individual concedido, etc.
 *
 * Hierarquia (CFO-first): este override tem prioridade sobre o calendário
 * mensal da organização e sobre o cálculo automático. Toda exceção exige
 * motivo registrado.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RotateCcw, Save, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmployees } from "@/hooks/useDP";
import {
  usePayrollDayOverrides,
  useMutatePayrollDayOverride,
  useBusinessDayOverrides,
  resolveBusinessDays,
  validateBusinessDays,
} from "@/hooks/useBusinessDays";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRunId: string;
  referenceMonth: string; // yyyy-MM-dd
};

export default function PayrollDaysAdjustmentDialog({
  open, onOpenChange, payrollRunId, referenceMonth,
}: Props) {
  const { data: employees = [] } = useEmployees();
  const { data: monthlyOverrides = [] } = useBusinessDayOverrides();
  const { data: empOverrides = [] } = usePayrollDayOverrides(payrollRunId);
  const { upsert, remove } = useMutatePayrollDayOverride();
  const { toast } = useToast();

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

  const overrideByEmp = useMemo(() => {
    const m = new Map<string, { days: number; reason: string | null }>();
    for (const o of empOverrides) {
      m.set(o.employee_id, { days: o.business_days_used, reason: o.reason });
    }
    return m;
  }, [empOverrides]);

  const [drafts, setDrafts] = useState<Record<string, { days: string; reason: string }>>({});

  // Ao abrir/atualizar overrides remotos, descarta rascunhos antigos
  useEffect(() => {
    if (open) setDrafts({});
  }, [open, payrollRunId]);

  const getValue = (empId: string, defaults: { days: number; reason: string }) =>
    drafts[empId] ?? { days: String(defaults.days), reason: defaults.reason };

  const setDraft = (empId: string, patch: Partial<{ days: string; reason: string }>) => {
    setDrafts((prev) => ({
      ...prev,
      [empId]: { ...(prev[empId] ?? { days: "", reason: "" }), ...patch },
    }));
  };

  const handleSave = (empId: string, defaults: { days: number; reason: string }, hasOverride: boolean) => {
    const draft = drafts[empId];
    if (!draft) return;
    const days = Number(draft.days);
    if (!Number.isInteger(days) || days < 0 || days > 31) {
      toast({
        title: "Quantidade inválida",
        description: "Informe um número inteiro entre 0 e 31.",
        variant: "destructive",
      });
      return;
    }
    // Se voltou ao padrão e não havia override, não faz nada
    if (!hasOverride && days === defaults.days && (draft.reason ?? "") === "") {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[empId];
        return next;
      });
      return;
    }
    upsert.mutate(
      {
        payroll_run_id: payrollRunId,
        employee_id: empId,
        business_days_used: days,
        reason: draft.reason?.trim() || null,
      },
      {
        onSuccess: () => {
          toast({ title: "Ajuste registrado" });
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[empId];
            return next;
          });
        },
        onError: (e: any) =>
          toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
      },
    );
  };

  const handleReset = (empId: string, hasOverride: boolean) => {
    if (!hasOverride) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[empId];
        return next;
      });
      return;
    }
    remove.mutate(
      { payroll_run_id: payrollRunId, employee_id: empId },
      {
        onSuccess: () => {
          toast({ title: "Override removido", description: "Voltou ao padrão do mês." });
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[empId];
            return next;
          });
        },
        onError: (e: any) =>
          toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajustar dias úteis por colaborador</DialogTitle>
          <DialogDescription>
            Folha de <strong className="capitalize">{monthLabel}</strong> · padrão do mês:{" "}
            <strong>{standard.days} dias úteis</strong>{" "}
            <span className="text-muted-foreground">
              ({standard.source === "monthly" ? "calendário da empresa" : "automático seg-sex"})
            </span>.
            Use este ajuste apenas para exceções individuais (férias parciais, banco de horas, afastamento).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center w-28">Padrão</TableHead>
                <TableHead className="text-center w-28">Efetivo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="w-44 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                    Nenhum colaborador ativo.
                  </TableCell>
                </TableRow>
              ) : (
                activeEmployees.map((emp: any) => {
                  const override = overrideByEmp.get(emp.id);
                  const hasOverride = !!override;
                  const defaults = {
                    days: override?.days ?? standard.days,
                    reason: override?.reason ?? "",
                  };
                  const v = getValue(emp.id, defaults);
                  const numericDays = Number(v.days);
                  const dirty =
                    !Number.isNaN(numericDays) &&
                    (numericDays !== defaults.days || (v.reason ?? "") !== defaults.reason);
                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{emp.name}</span>
                          {hasOverride && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              Ajustado
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{emp.contract_type}</p>
                      </TableCell>
                      <TableCell className="text-center font-mono text-muted-foreground">
                        {standard.days}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={31}
                          value={v.days}
                          onChange={(e) => setDraft(emp.id, { days: e.target.value })}
                          className="h-8 w-20 mx-auto text-center font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Ex.: 5 dias de banco de horas"
                          value={v.reason}
                          onChange={(e) => setDraft(emp.id, { reason: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleReset(emp.id, hasOverride)}
                            disabled={remove.isPending || (!hasOverride && !drafts[emp.id])}
                          >
                            <RotateCcw size={12} className="mr-1" />
                            {hasOverride ? "Limpar" : "Descartar"}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSave(emp.id, defaults, hasOverride)}
                            disabled={!dirty || upsert.isPending}
                          >
                            <Save size={12} className="mr-1" /> Salvar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
