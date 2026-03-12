import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);

interface MaterializeItem {
  entry: FinanceiroEntry;
  selected: boolean;
  valor_realizado: number;
  data_realizada: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FinanceiroEntry[];
  onConfirm: (items: { id: string; valor_realizado: number; data_realizada: string; isProjected: true }[]) => Promise<void>;
  isPending: boolean;
}

export function MaterializeDialog({ open, onOpenChange, entries, onConfirm, isPending }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [items, setItems] = useState<MaterializeItem[]>([]);

  // Reset items when entries change
  useMemo(() => {
    setItems(
      entries.map((e) => ({
        entry: e,
        selected: true,
        valor_realizado: e.valor_previsto,
        data_realizada: today,
      }))
    );
  }, [entries, today]);

  const selectedCount = items.filter((i) => i.selected).length;

  const toggleItem = (idx: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item)));
  };

  const updateValue = (idx: number, val: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, valor_realizado: val } : item)));
  };

  const updateDate = (idx: number, date: string) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, data_realizada: date } : item)));
  };

  const handleConfirm = async () => {
    const selected = items
      .filter((i) => i.selected)
      .map((i) => ({
        id: i.entry.id,
        valor_realizado: i.valor_realizado,
        data_realizada: i.data_realizada,
        isProjected: true as const,
      }));
    await onConfirm(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Classificar Pendências</DialogTitle>
          <DialogDescription>
            Revise e confirme os valores para materializar as projeções selecionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.entry.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                item.selected ? "border-primary/30 bg-primary/5" : "border-muted bg-muted/30 opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={item.selected}
                  onCheckedChange={() => toggleItem(idx)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.entry.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    Previsto: {fmt(item.entry.valor_previsto)} em {format(new Date(item.entry.data_prevista), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              {item.selected && (
                <div className="grid grid-cols-2 gap-3 pl-8">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Realizado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.valor_realizado}
                      onChange={(e) => updateValue(idx, Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data Realizada</Label>
                    <Input
                      type="date"
                      value={item.data_realizada}
                      onChange={(e) => updateDate(idx, e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || selectedCount === 0}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Confirmar {selectedCount} item(ns)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
