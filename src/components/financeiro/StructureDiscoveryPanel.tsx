import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle, ChevronDown, ChevronRight, Plus, Eye, EyeOff, Sparkles, Layers, Tag,
} from "lucide-react";
import { useStructureDiscovery, type OrphanItem } from "@/hooks/useStructureDiscovery";
import { toast } from "sonner";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

interface StructureDiscoveryPanelProps {
  onCreateCategory?: (name: string) => void;
  onCreateCostCenter?: (name: string) => void;
  onCreateRule?: (matchField: string, matchValue: string) => void;
}

export default function StructureDiscoveryPanel({
  onCreateCategory,
  onCreateCostCenter,
  onCreateRule,
}: StructureDiscoveryPanelProps) {
  const { orphans, orphanCategories, orphanPatterns, totalOrphans, ignore, clearIgnored, ignoredCount } = useStructureDiscovery();
  const [open, setOpen] = useState(true);

  if (totalOrphans === 0 && ignoredCount === 0) return null;

  const handleAction = (item: OrphanItem) => {
    switch (item.suggestedAction) {
      case "create_category":
        onCreateCategory?.(item.value);
        break;
      case "create_cost_center":
        onCreateCostCenter?.(item.value);
        break;
      case "create_rule":
        onCreateRule?.(item.type === "category" ? "categoria" : "descricao", item.value);
        break;
    }
  };

  const handleIgnore = (item: OrphanItem) => {
    const key = item.type === "category" ? `cat:${item.value}` : `pat:${item.value}`;
    ignore(key);
    toast.success("Item ignorado");
  };

  return (
    <Card className="border-amber-500/30 bg-amber-50/5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">Descoberta de Estrutura</CardTitle>
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                  {totalOrphans} pendente{totalOrphans !== 1 ? "s" : ""}
                </Badge>
              </div>
              {ignoredCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={(e) => { e.stopPropagation(); clearIgnored(); }}>
                  <Eye className="h-3 w-3 mr-1" /> Mostrar {ignoredCount} ignorado{ignoredCount !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              Categorias e padrões detectados nos lançamentos importados que ainda não existem na estrutura do sistema.
              Promova-os para integrar à governança financeira.
            </p>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              {orphanCategories.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {orphanCategories.length} categoria{orphanCategories.length !== 1 ? "s" : ""} sem registro
                </Badge>
              )}
              {orphanPatterns.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {orphanPatterns.length} padrão{orphanPatterns.length !== 1 ? "ões" : ""} sem regra
                </Badge>
              )}
            </div>

            {/* Table */}
            {totalOrphans > 0 && (
              <div className="max-h-[300px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Valor</TableHead>
                      <TableHead className="text-xs text-right">Frequência</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right w-[180px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphans.map((item, i) => (
                      <TableRow key={`${item.type}-${item.value}-${i}`}>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {item.type === "category" ? "Categoria" : item.type === "cost_center" ? "C. Custo" : "Padrão"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate">{item.value}</TableCell>
                        <TableCell className="text-xs text-right">{item.frequency}x</TableCell>
                        <TableCell className="text-xs text-right">{fmt.format(item.total)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() => handleAction(item)}
                            >
                              <Plus className="h-3 w-3 mr-0.5" />
                              {item.suggestedAction === "create_category" ? "Criar Categoria" :
                               item.suggestedAction === "create_cost_center" ? "Criar C. Custo" : "Criar Regra"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() => handleIgnore(item)}
                            >
                              <EyeOff className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
