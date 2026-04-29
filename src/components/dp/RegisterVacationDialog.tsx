import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useMutateVacation } from "@/hooks/useDP";
import type { AcquisitionPeriod } from "@/lib/vacationCalculations";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: { id: string; name: string; salary_base?: number | null } | null;
  periodosAbertos: AcquisitionPeriod[];
}

export default function RegisterVacationDialog({ open, onOpenChange, employee, periodosAbertos }: Props) {
  const { create } = useMutateVacation();
  const [paIdx, setPaIdx] = useState<string>("");
  const [tipo, setTipo] = useState<"gozo" | "abono_venda" | "programado">("gozo");
  const [dias, setDias] = useState<number>(30);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && periodosAbertos.length > 0) {
      setPaIdx(String(periodosAbertos[0].index));
      setTipo("gozo");
      setDias(Math.min(30, periodosAbertos[0].diasSaldo));
      setDataInicio("");
      setObservacoes("");
    }
  }, [open, periodosAbertos]);

  const pa = useMemo(
    () => periodosAbertos.find((p) => String(p.index) === paIdx) ?? null,
    [paIdx, periodosAbertos],
  );

  const maxDias = useMemo(() => {
    if (!pa) return 0;
    if (tipo === "abono_venda") {
      // Max 10 days per PA, respecting what was already sold
      return Math.max(0, Math.min(10 - pa.diasVendidos, pa.diasSaldo));
    }
    return pa.diasSaldo;
  }, [pa, tipo]);

  useEffect(() => {
    if (dias > maxDias) setDias(maxDias);
  }, [maxDias, dias]);

  const salario = Number(employee?.salary_base || 0);
  const valorFerias = (salario / 30) * dias;
  const valorTerco = valorFerias / 3;
  const valorTotal = valorFerias + valorTerco;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const submit = async () => {
    if (!employee || !pa) return;
    if (dias <= 0) {
      toast.error("Informe a quantidade de dias");
      return;
    }
    if (dias > maxDias) {
      toast.error(`Máximo permitido: ${maxDias} dias`);
      return;
    }
    if (tipo === "gozo" && !dataInicio) {
      toast.error("Informe a data de início do gozo");
      return;
    }
    setSubmitting(true);
    try {
      await create.mutateAsync({
        employee_id: employee.id,
        periodo_aquisitivo_inicio: format(pa.inicio, "yyyy-MM-dd"),
        periodo_aquisitivo_fim: format(pa.fim, "yyyy-MM-dd"),
        data_inicio: tipo === "gozo" ? dataInicio : null,
        data_fim:
          tipo === "gozo" && dataInicio
            ? format(new Date(new Date(dataInicio).getTime() + (dias - 1) * 86400000), "yyyy-MM-dd")
            : null,
        dias_gozados: tipo === "gozo" ? dias : 0,
        dias_vendidos: tipo === "abono_venda" ? dias : 0,
        valor_ferias: valorFerias,
        valor_terco: valorTerco,
        valor_total: valorTotal,
        status: tipo === "programado" ? "programado" : tipo === "gozo" ? "concluida" : "concluida",
        tipo,
        observacoes: observacoes || null,
      });
      toast.success(tipo === "abono_venda" ? "Venda de férias registrada" : "Gozo de férias registrado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar férias");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Férias — {employee?.name}</DialogTitle>
        </DialogHeader>
        {periodosAbertos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum período aquisitivo em aberto.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Período Aquisitivo</Label>
              <Select value={paIdx} onValueChange={setPaIdx}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodosAbertos.map((p) => (
                    <SelectItem key={p.index} value={String(p.index)}>
                      PA {p.index} — {format(p.inicio, "dd/MM/yyyy")} a {format(p.fim, "dd/MM/yyyy")} (saldo {p.diasSaldo}d)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gozo">Gozo de férias</SelectItem>
                  <SelectItem value="abono_venda">Venda (abono pecuniário — máx. 10d)</SelectItem>
                  <SelectItem value="programado">Apenas programar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dias (máx. {maxDias})</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxDias}
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                />
              </div>
              {tipo !== "abono_venda" && (
                <div>
                  <Label>Data início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
              )}
            </div>

            {tipo === "gozo" && dias < 14 && (
              <p className="text-xs text-amber-600">
                Aviso CLT: gozo recomendado de no mínimo 14 dias contínuos no primeiro fracionamento.
              </p>
            )}

            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <p>Valor proporcional: <span className="font-mono">{fmt(valorFerias)}</span></p>
              <p>1/3 constitucional: <span className="font-mono">{fmt(valorTerco)}</span></p>
              <p className="font-semibold">Total: <span className="font-mono">{fmt(valorTotal)}</span></p>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting || !pa}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
