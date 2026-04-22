import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, AlertTriangle } from "lucide-react";
import { useEmployees, useMutateTermination, useDPConfig } from "@/hooks/useDP";
import { useToast } from "@/hooks/use-toast";
import { differenceInMonths, format } from "date-fns";

export const TERM_TYPES = [
  { value: "sem_justa_causa", label: "Sem justa causa" },
  { value: "com_justa_causa", label: "Com justa causa" },
  { value: "pedido_demissao", label: "Pedido de demissão" },
  { value: "acordo", label: "Acordo (reforma)" },
];

/** Tipos PJ — distrato comercial, não rescisão trabalhista */
export const PJ_TERM_TYPES = [
  { value: "distrato_aviso", label: "Distrato com aviso prévio contratual" },
  { value: "distrato_imediato", label: "Distrato imediato" },
  { value: "fim_contrato", label: "Fim natural do contrato" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialEmployeeId?: string;
  /** ID do item de hr_planning_items que originou esta rescisão (fecha o ciclo planejamento → execução). */
  hrPlanningItemId?: string;
  /** Data planejada vinda do item de RH (pré-preenche a data de desligamento). */
  initialTerminationDate?: string;
}

export default function TerminationSimulatorDialog({ open, onOpenChange, initialEmployeeId, hrPlanningItemId, initialTerminationDate }: Props) {
  const { data: employees = [] } = useEmployees();
  const { data: dpConfig } = useDPConfig();
  const { create } = useMutateTermination();
  const { toast } = useToast();

  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [termType, setTermType] = useState("sem_justa_causa");
  const [termDate, setTermDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [simResult, setSimResult] = useState<any>(null);

  const activeEmps = employees.filter((e: any) => e.status === "ativo");
  const empMap = useMemo(() => {
    const m: Record<string, any> = {};
    employees.forEach((e: any) => { m[e.id] = e; });
    return m;
  }, [employees]);

  // Reset / pre-fill on open
  useEffect(() => {
    if (open) {
      setSelectedEmpId(initialEmployeeId || "");
      setTermType("sem_justa_causa");
      setTermDate(initialTerminationDate || format(new Date(), "yyyy-MM-dd"));
      setSimResult(null);
    }
  }, [open, initialEmployeeId, initialTerminationDate]);

  const selectedEmp = empMap[selectedEmpId];
  const isPJ = selectedEmp?.contract_type === "PJ";
  const isEstagio = selectedEmp?.contract_type === "estagio";
  const termTypeOptions = isPJ ? PJ_TERM_TYPES : TERM_TYPES;

  // Reset termType quando trocar de colaborador entre regimes incompatíveis
  useEffect(() => {
    if (!selectedEmp) return;
    const validValues = (isPJ ? PJ_TERM_TYPES : TERM_TYPES).map((t) => t.value);
    if (!validValues.includes(termType)) {
      setTermType(validValues[0]);
      setSimResult(null);
    }
  }, [selectedEmpId, isPJ, termType, selectedEmp]);

  const handleSimulate = () => {
    const emp = empMap[selectedEmpId];
    if (!emp) return;

    const salario = Number(emp.salary_base || 0);
    const admDate = new Date(emp.admission_date);
    const tDate = new Date(termDate);
    const monthsWorked = differenceInMonths(tDate, admDate);
    const currentMonthDay = tDate.getDate();
    const saldoSalario = (salario / 30) * currentMonthDay;

    // ============== PJ: distrato comercial, sem verbas trabalhistas ==============
    if (emp.contract_type === "PJ") {
      // Aviso prévio contratual: paga-se proporcional aos dias contratuais (default: 30 se houver aviso).
      // Não há FGTS, multa, 13º, férias proporcionais — relação é cível, não trabalhista.
      const avisoContratual = termType === "distrato_aviso" ? salario : 0;
      const total = saldoSalario + avisoContratual;
      setSimResult({
        contract_type: "PJ",
        saldo_salario: Math.round(saldoSalario * 100) / 100,
        aviso_previo: Math.round(avisoContratual * 100) / 100,
        ferias_proporcionais: 0,
        terco_ferias: 0,
        decimo_terceiro_proporcional: 0,
        multa_fgts: 0,
        total_rescisao: Math.round(total * 100) / 100,
      });
      return;
    }

    // ============== Estágio: bolsa proporcional + recesso (sem FGTS/13º) ==============
    if (emp.contract_type === "estagio") {
      // Recesso remunerado proporcional (Lei 11.788, art. 13): 30 dias após 12 meses.
      const recessoProp = (salario / 12) * (monthsWorked % 12);
      const total = saldoSalario + recessoProp;
      setSimResult({
        contract_type: "estagio",
        saldo_salario: Math.round(saldoSalario * 100) / 100,
        aviso_previo: 0,
        ferias_proporcionais: Math.round(recessoProp * 100) / 100, // armazena recesso no campo férias
        terco_ferias: 0,
        decimo_terceiro_proporcional: 0,
        multa_fgts: 0,
        total_rescisao: Math.round(total * 100) / 100,
      });
      return;
    }

    // ============== CLT: cálculo padrão de rescisão trabalhista ==============
    const anosCompletos = Math.floor(monthsWorked / 12);
    const diasAviso = termType === "sem_justa_causa" ? 30 + (anosCompletos * 3) : 0;
    const avisoPrevio = termType === "sem_justa_causa" ? (salario / 30) * diasAviso : 0;
    const mesesDesdeUltimasFerrias = monthsWorked % 12;
    const feriasProporcionais = termType !== "com_justa_causa" ? (salario / 12) * mesesDesdeUltimasFerrias : 0;
    const tercoFerias = feriasProporcionais / 3;
    const meses13 = tDate.getMonth() + 1;
    const decimoTerceiro = termType !== "com_justa_causa" ? (salario / 12) * meses13 : 0;
    const fgtsMensal = salario * ((dpConfig?.fgts_pct ?? 8) / 100);
    const fgtsAcumulado = fgtsMensal * monthsWorked;
    const multaFGTS = termType === "sem_justa_causa" ? fgtsAcumulado * 0.4
      : termType === "acordo" ? fgtsAcumulado * 0.2 : 0;

    const total = saldoSalario + avisoPrevio + feriasProporcionais + tercoFerias + decimoTerceiro + multaFGTS;

    setSimResult({
      contract_type: "CLT",
      saldo_salario: Math.round(saldoSalario * 100) / 100,
      aviso_previo: Math.round(avisoPrevio * 100) / 100,
      ferias_proporcionais: Math.round(feriasProporcionais * 100) / 100,
      terco_ferias: Math.round(tercoFerias * 100) / 100,
      decimo_terceiro_proporcional: Math.round(decimoTerceiro * 100) / 100,
      multa_fgts: Math.round(multaFGTS * 100) / 100,
      total_rescisao: Math.round(total * 100) / 100,
    });
  };

  const handleSaveTermination = () => {
    if (!simResult || !selectedEmpId) return;
    // contract_type agora é persistido como snapshot imutável do regime na data da rescisão.
    // hr_planning_item_id fecha o ciclo planejamento → execução (quando aplicável).
    create.mutate({
      employee_id: selectedEmpId,
      termination_date: termDate,
      type: termType,
      hr_planning_item_id: hrPlanningItemId,
      ...simResult,
    }, {
      onSuccess: () => {
        toast({
          title: hrPlanningItemId ? "Rescisão registrada e item de planejamento concluído" : "Rescisão registrada",
        });
        onOpenChange(false);
      },
    });
  };

  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const feriasLabel = isEstagio ? "Recesso Proporcional" : "Férias Proporcionais";
  const avisoLabel = isPJ ? "Aviso Contratual" : "Aviso Prévio";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Simulador de Desligamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {hrPlanningItemId && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-foreground">
              Esta rescisão será vinculada a um item de <span className="font-semibold">Planejamento de RH</span> e marcará o item como executado.
            </div>
          )}
          <div className="space-y-1">
            <Label>Colaborador</Label>
            <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {activeEmps.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.contract_type} — {fmt(Number(e.salary_base))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEmp && (
              <p className="text-[11px] text-muted-foreground">
                Regime: <span className="font-medium text-foreground">{selectedEmp.contract_type}</span>
                {isPJ && " · sem verbas trabalhistas (relação cível)"}
                {isEstagio && " · sem FGTS/13º (Lei 11.788)"}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={termType} onValueChange={setTermType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{termTypeOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={termDate} onChange={(e) => setTermDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSimulate} disabled={!selectedEmpId} className="w-full">
            <Calculator size={14} className="mr-1" /> Calcular
          </Button>

          {simResult && (
            <div className="border border-border rounded-lg p-4 space-y-2 bg-muted/30">
              <div className="flex justify-between text-sm"><span>Saldo de Salário</span><span className="font-mono">{fmt(simResult.saldo_salario)}</span></div>
              {simResult.aviso_previo > 0 && (
                <div className="flex justify-between text-sm"><span>{avisoLabel}</span><span className="font-mono">{fmt(simResult.aviso_previo)}</span></div>
              )}
              {simResult.ferias_proporcionais > 0 && (
                <div className="flex justify-between text-sm"><span>{feriasLabel}</span><span className="font-mono">{fmt(simResult.ferias_proporcionais)}</span></div>
              )}
              {simResult.terco_ferias > 0 && (
                <div className="flex justify-between text-sm"><span>1/3 Férias</span><span className="font-mono">{fmt(simResult.terco_ferias)}</span></div>
              )}
              {simResult.decimo_terceiro_proporcional > 0 && (
                <div className="flex justify-between text-sm"><span>13º Proporcional</span><span className="font-mono">{fmt(simResult.decimo_terceiro_proporcional)}</span></div>
              )}
              {simResult.multa_fgts > 0 && (
                <div className="flex justify-between text-sm text-destructive"><span>Multa FGTS</span><span className="font-mono">{fmt(simResult.multa_fgts)}</span></div>
              )}
              {(isPJ || isEstagio) && (
                <p className="text-[11px] text-muted-foreground italic pt-1">
                  {isPJ
                    ? "PJ não gera FGTS, multa rescisória, 13º ou férias — pagamentos contratuais regidos pelo contrato de prestação de serviço."
                    : "Estagiário não gera FGTS, 13º ou multa — apenas bolsa proporcional + recesso remunerado."}
                </p>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total Rescisão</span>
                <span className="font-mono text-lg">{fmt(simResult.total_rescisao)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <AlertTriangle size={12} />
                <span>Impacto imediato no caixa: {fmt(simResult.total_rescisao)}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {simResult && (
            <Button onClick={handleSaveTermination} disabled={create.isPending}>
              Registrar Rescisão
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
