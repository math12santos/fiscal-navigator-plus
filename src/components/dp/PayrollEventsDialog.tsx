import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/useDP";
import {
  usePayrollEvents,
  useMutatePayrollEvent,
  PAYROLL_EVENT_TYPES,
  summarizeEvents,
  type PayrollEventType,
} from "@/hooks/usePayrollEvents";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payrollRunId: string;
  referenceMonth: string;
}

export default function PayrollEventsDialog({ open, onOpenChange, payrollRunId, referenceMonth }: Props) {
  const { toast } = useToast();
  const { data: employees = [] } = useEmployees();
  const { data: events = [] } = usePayrollEvents({ runId: payrollRunId });
  const { create, remove } = useMutatePayrollEvent();

  const [employeeId, setEmployeeId] = useState("");
  const [eventType, setEventType] = useState<PayrollEventType>("hora_extra_50");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [value, setValue] = useState("");

  const selectedTypeMeta = PAYROLL_EVENT_TYPES.find((t) => t.value === eventType);
  const empMap = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach((e: any) => { m[e.id] = e.name; });
    return m;
  }, [employees]);

  const summary = summarizeEvents(events);
  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleAdd = () => {
    if (!employeeId || !value) {
      toast({ title: "Selecione o colaborador e informe o valor", variant: "destructive" });
      return;
    }
    create.mutate(
      {
        employee_id: employeeId,
        payroll_run_id: payrollRunId,
        event_type: eventType,
        signal: selectedTypeMeta?.signal as "provento" | "desconto",
        description: description || selectedTypeMeta?.label || eventType,
        reference: reference || null,
        value: Number(value),
        reference_month: referenceMonth,
      },
      {
        onSuccess: () => {
          toast({ title: "Lançamento adicionado" });
          setEmployeeId("");
          setDescription("");
          setReference("");
          setValue("");
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançamentos variáveis da folha</DialogTitle>
          <DialogDescription>
            Adicione horas extras, faltas, bônus, descontos pontuais e outros eventos que entram no cálculo do líquido
            desta folha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4 space-y-1">
              <Label className="text-xs">Colaborador</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e: any) => e.status === "ativo")
                    .map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as PayrollEventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYROLL_EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} {t.signal === "provento" ? "↑" : "↓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Referência</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="10h, 2d..."
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <Button className="col-span-1" size="sm" onClick={handleAdd} disabled={create.isPending}>
              <Plus size={14} />
            </Button>
            <div className="col-span-12 space-y-1">
              <Input
                placeholder="Descrição (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Proventos</p>
              <p className="font-bold font-mono text-foreground">{fmt(summary.proventos)}</p>
            </div>
            <div className="bg-card border rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Descontos</p>
              <p className="font-bold font-mono text-destructive">{fmt(summary.descontos)}</p>
            </div>
            <div className="bg-card border rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Líquido eventos</p>
              <p className="font-bold font-mono text-primary">{fmt(summary.liquido)}</p>
            </div>
          </div>

          {/* Lista */}
          <div className="border border-border rounded-lg overflow-hidden">
            {events.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted-foreground">Nenhum lançamento variável.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Ref.</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-sm font-medium">{empMap[ev.employee_id] || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={ev.signal === "provento" ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {PAYROLL_EVENT_TYPES.find((t) => t.value === ev.event_type)?.label || ev.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ev.description}</TableCell>
                      <TableCell className="text-xs">{ev.reference || "—"}</TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          ev.signal === "desconto" ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {ev.signal === "desconto" ? "−" : "+"}{fmt(Number(ev.value))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => remove.mutate(ev.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
