import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface Item {
  label: string;
  value: string | number;
  hint?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  formula: string;
  total: string;
  items: Item[];
}

export function KpiBreakdownDialog({ open, onOpenChange, title, formula, total, items }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Card className="bg-muted/30">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Fórmula aplicada</p>
            <p className="text-sm font-mono">{formula}</p>
            <p className="text-2xl font-bold mt-2 text-primary">{total}</p>
          </CardContent>
        </Card>

        <div className="mt-4">
          <p className="text-sm font-semibold mb-2">Itens que compõem o cálculo ({items.length})</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem itens.</p>
          ) : (
            <div className="border rounded-md max-h-[40vh] overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2">
                        <div>{it.label}</div>
                        {it.hint && <div className="text-xs text-muted-foreground">{it.hint}</div>}
                      </td>
                      <td className="p-2 text-right font-mono">{it.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
