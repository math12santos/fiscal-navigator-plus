import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DuplicatePair } from "@/hooks/useDuplicateDetection";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  duplicates: DuplicatePair[];
}

export function DuplicateAlerts({ duplicates }: Props) {
  if (duplicates.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-destructive/50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Possíveis duplicidades detectadas ({duplicates.length})</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-sm">
          {duplicates.slice(0, 5).map((d, i) => (
            <li key={i} className="flex flex-wrap gap-1">
              <span className="font-medium">"{d.a.descricao}"</span>
              <span>vs</span>
              <span className="font-medium">"{d.b.descricao}"</span>
              <span className="text-muted-foreground">— {d.reason}</span>
            </li>
          ))}
          {duplicates.length > 5 && (
            <li className="text-muted-foreground">...e mais {duplicates.length - 5} pares suspeitos</li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
