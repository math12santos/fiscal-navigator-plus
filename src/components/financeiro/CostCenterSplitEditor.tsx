import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCostCenters } from "@/hooks/useCostCenters";
import { Plus, Trash2 } from "lucide-react";

interface Split {
  cost_center_id: string;
  percentual: number;
  valor: number;
}

interface Props {
  totalValue: number;
  splits: Split[];
  onChange: (splits: Split[]) => void;
}

export function CostCenterSplitEditor({ totalValue, splits, onChange }: Props) {
  const { costCenters } = useCostCenters();
  const activeCenters = costCenters.filter((c) => c.active);

  const addSplit = () => {
    const unused = activeCenters.find((c) => !splits.some((s) => s.cost_center_id === c.id));
    if (unused) {
      onChange([...splits, { cost_center_id: unused.id, percentual: 0, valor: 0 }]);
    }
  };

  const removeSplit = (idx: number) => {
    onChange(splits.filter((_, i) => i !== idx));
  };

  const updateSplit = (idx: number, field: "percentual" | "valor" | "cost_center_id", value: any) => {
    const updated = [...splits];
    updated[idx] = { ...updated[idx], [field]: value };

    if (field === "percentual" && totalValue > 0) {
      updated[idx].valor = Math.round((value / 100) * totalValue * 100) / 100;
    } else if (field === "valor" && totalValue > 0) {
      updated[idx].percentual = Math.round((value / totalValue) * 10000) / 100;
    }

    onChange(updated);
  };

  const totalPct = splits.reduce((s, r) => s + r.percentual, 0);
  const totalVal = splits.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Rateio entre Centros de Custo</Label>
        <Button variant="outline" size="sm" onClick={addSplit} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>

      {splits.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro de Custo</TableHead>
                <TableHead className="w-24">%</TableHead>
                <TableHead className="w-28">Valor (R$)</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {splits.map((split, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Select value={split.cost_center_id} onValueChange={(v) => updateSplit(idx, "cost_center_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeCenters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={split.percentual}
                      onChange={(e) => updateSplit(idx, "percentual", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={split.valor}
                      onChange={(e) => updateSplit(idx, "valor", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSplit(idx)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="text-xs font-medium">Total</TableCell>
                <TableCell className={`text-xs font-medium ${Math.abs(totalPct - 100) > 0.01 && splits.length > 0 ? "text-destructive" : ""}`}>
                  {totalPct.toFixed(2)}%
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalVal)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {splits.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum rateio configurado. O centro de custo principal será utilizado.</p>
      )}
    </div>
  );
}
