import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Eye, EyeOff, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DuplicatePair, DuplicateCategory } from "@/hooks/useDuplicateDetection";
import { CATEGORY_LABELS } from "@/hooks/useDuplicateDetection";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

interface Props {
  duplicates: DuplicatePair[];
  onDelete?: (id: string) => void;
}

export function DuplicateAlerts({ duplicates, onDelete }: Props) {
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openCategories, setOpenCategories] = useState<Set<DuplicateCategory>>(new Set());

  if (duplicates.length === 0) return null;

  const visible = duplicates.filter((d) => !ignored.has(pairKey(d)));
  if (visible.length === 0) return null;

  // Group by category
  const grouped = new Map<DuplicateCategory, DuplicatePair[]>();
  for (const d of visible) {
    const list = grouped.get(d.category) || [];
    list.push(d);
    grouped.set(d.category, list);
  }

  const highCount = visible.filter((d) => d.severity === "high").length;

  return (
    <Alert
      variant="destructive"
      className={highCount > 0 ? "border-destructive/50" : "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10 text-amber-900 dark:text-amber-200"}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        Possíveis duplicidades detectadas ({visible.length})
        {ignored.size > 0 && (
          <span className="text-xs font-normal text-muted-foreground ml-2">
            ({ignored.size} ignoradas)
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        {Array.from(grouped.entries()).map(([category, pairs]) => (
          <Collapsible
            key={category}
            open={openCategories.has(category)}
            onOpenChange={(open) => {
              setOpenCategories((prev) => {
                const next = new Set(prev);
                open ? next.add(category) : next.delete(category);
                return next;
              });
            }}
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm hover:underline">
              {openCategories.has(category) ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="font-medium">{CATEGORY_LABELS[category]}</span>
              <Badge
                variant={pairs[0].severity === "high" ? "destructive" : "secondary"}
                className="text-[10px] ml-1"
              >
                {pairs.length}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 ml-5 space-y-1.5">
              {pairs.slice(0, 10).map((d) => {
                const pk = pairKey(d);
                const isExpanded = expanded.has(pk);

                return (
                  <div key={pk} className="text-xs border rounded-md p-2 space-y-1 bg-background/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">"{d.a.descricao}"</span>
                        <span className="text-muted-foreground mx-1">vs</span>
                        <span className="font-medium">"{d.b.descricao}"</span>
                        <span className="text-muted-foreground ml-1">— {d.reason}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                          onClick={() => setExpanded((prev) => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(pk) : next.add(pk);
                            return next;
                          })}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Ignorar"
                          onClick={() => setIgnored((prev) => new Set(prev).add(pk))}
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                        {onDelete && !d.a.id.startsWith("proj-") && !d.b.id.startsWith("proj-") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            title="Excluir duplicata (B)"
                            onClick={() => onDelete(d.b.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t text-[11px]">
                        <div className="space-y-0.5">
                          <p className="font-medium text-muted-foreground">Lançamento A</p>
                          <p>Descrição: {d.a.descricao}</p>
                          <p>Valor: {fmt(Number(d.a.valor_previsto))}</p>
                          <p>Data: {fmtDate(d.a.data_prevista)}</p>
                          <p>Fonte: {d.a.source}</p>
                          <p>Status: {d.a.status}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-medium text-muted-foreground">Lançamento B</p>
                          <p>Descrição: {d.b.descricao}</p>
                          <p>Valor: {fmt(Number(d.b.valor_previsto))}</p>
                          <p>Data: {fmtDate(d.b.data_prevista)}</p>
                          <p>Fonte: {d.b.source}</p>
                          <p>Status: {d.b.status}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {pairs.length > 10 && (
                <p className="text-[11px] text-muted-foreground">
                  ...e mais {pairs.length - 10} pares nesta categoria
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </AlertDescription>
    </Alert>
  );
}

function pairKey(d: DuplicatePair): string {
  return [d.a.id, d.b.id].sort().join("|");
}
