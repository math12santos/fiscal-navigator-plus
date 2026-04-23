import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEmployees, usePositions } from "@/hooks/useDP";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useMassSalaryAdjustment } from "@/hooks/useMassSalaryAdjustment";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function MassAdjustmentDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { data: employees = [] } = useEmployees();
  const { data: positions = [] } = usePositions();
  const { costCenters = [] } = useCostCenters();
  const mutation = useMassSalaryAdjustment();

  const [filterPosition, setFilterPosition] = useState("__all__");
  const [filterCC, setFilterCC] = useState("__all__");
  const [filterContract, setFilterContract] = useState("__all__");
  const [mode, setMode] = useState<"percentage" | "fixed">("percentage");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Dissídio coletivo");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return employees.filter((e: any) => {
      if (e.status !== "ativo") return false;
      if (filterPosition !== "__all__" && e.position_id !== filterPosition) return false;
      if (filterCC !== "__all__" && e.cost_center_id !== filterCC) return false;
      if (filterContract !== "__all__" && e.contract_type !== filterContract) return false;
      return true;
    });
  }, [employees, filterPosition, filterCC, filterContract]);

  const allChecked = filtered.length > 0 && filtered.every((e: any) => selected.has(e.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((e: any) => next.delete(e.id));
      else filtered.forEach((e: any) => next.add(e.id));
      return next;
    });
  };

  const previewImpact = useMemo(() => {
    const amt = Number(amount) || 0;
    let totalOld = 0,
      totalNew = 0;
    filtered.forEach((e: any) => {
      if (!selected.has(e.id)) return;
      const old = Number(e.salary_base || 0);
      const next = mode === "percentage" ? old * (1 + amt / 100) : old + amt;
      totalOld += old;
      totalNew += next;
    });
    return { totalOld, totalNew, delta: totalNew - totalOld, count: [...selected].length };
  }, [filtered, selected, amount, mode]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleApply = () => {
    if (!amount || selected.size === 0) {
      toast({ title: "Preencha o valor e selecione colaboradores", variant: "destructive" });
      return;
    }
    if (
      !confirm(
        `Aplicar reajuste em ${selected.size} colaborador(es)?\nImpacto na folha: ${fmt(previewImpact.delta)} a mais.`,
      )
    )
      return;

    mutation.mutate(
      {
        employeeIds: [...selected],
        mode,
        amount: Number(amount),
        reason,
      },
      {
        onSuccess: ({ updated }) => {
          toast({ title: `Reajuste aplicado em ${updated} colaborador(es)` });
          onOpenChange(false);
          setSelected(new Set());
          setAmount("");
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reajuste em massa (Dissídio)</DialogTitle>
          <DialogDescription>
            Aplique um reajuste percentual ou valor fixo ao salário base de múltiplos colaboradores. O histórico fica
            registrado no dossiê de cada um.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Filtros */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Cargo</Label>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {positions.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Centro de Custo</Label>
              <Select value={filterCC} onValueChange={setFilterCC}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {costCenters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo Contrato</Label>
              <Select value={filterContract} onValueChange={setFilterContract}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                  <SelectItem value="estagio">Estágio</SelectItem>
                  <SelectItem value="intermitente">Intermitente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reajuste */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{mode === "percentage" ? "Percentual" : "Valor"}</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={mode === "percentage" ? "Ex: 5" : "Ex: 200"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motivo / observação</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>

          {/* Lista colaboradores */}
          <div className="border border-border rounded-lg max-h-72 overflow-y-auto">
            <div className="p-2 border-b sticky top-0 bg-card flex items-center gap-2">
              <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              <span className="text-xs font-medium">
                {selected.size} selecionado(s) de {filtered.length}
              </span>
            </div>
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Nenhum colaborador atende aos filtros.</p>
            ) : (
              filtered.map((e: any) => {
                const checked = selected.has(e.id);
                const old = Number(e.salary_base || 0);
                const amt = Number(amount) || 0;
                const next = mode === "percentage" ? old * (1 + amt / 100) : old + amt;
                return (
                  <label
                    key={e.id}
                    className="flex items-center gap-3 p-2 border-b border-border hover:bg-muted/30 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) =>
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (c) n.add(e.id);
                          else n.delete(e.id);
                          return n;
                        })
                      }
                    />
                    <span className="flex-1 font-medium text-foreground">{e.name}</span>
                    <span className="font-mono text-muted-foreground text-xs">{fmt(old)}</span>
                    {checked && amt > 0 && (
                      <>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="font-mono text-primary text-xs">{fmt(next)}</span>
                      </>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Impacto */}
          {selected.size > 0 && Number(amount) !== 0 && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Folha atual</Label>
                  <p className="font-bold font-mono text-foreground">{fmt(previewImpact.totalOld)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Folha pós-reajuste</Label>
                  <p className="font-bold font-mono text-primary">{fmt(previewImpact.totalNew)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Impacto mensal</Label>
                  <p className="font-bold font-mono text-warning">+{fmt(previewImpact.delta)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleApply} disabled={selected.size === 0 || !amount || mutation.isPending}>
            {mutation.isPending ? "Aplicando..." : "Aplicar reajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
