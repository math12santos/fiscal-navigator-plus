import { useState, useMemo } from "react";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useImportHistory } from "@/hooks/useImportHistory";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Undo2, Lock, Unlock, FileSpreadsheet, AlertTriangle } from "lucide-react";

export function ImportacoesTab() {
  const { imports, isLoading: importsLoading, revertImport } = useImportHistory();
  const { periods, isLoading: periodsLoading, isMonthClosed, closePeriod, reopenPeriod } = useFiscalPeriods();
  const { currentOrg } = useOrganization();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Generate last 12 months
  const months = useMemo(() => {
    const result: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = subMonths(startOfMonth(now), i);
      result.push(format(d, "yyyy-MM"));
    }
    return result;
  }, []);

  // Count imports per month
  const importsByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    imports.forEach((imp: any) => {
      const ym = imp.created_at?.slice(0, 7);
      if (ym) map[ym] = (map[ym] || 0) + 1;
    });
    return map;
  }, [imports]);

  const getImportYearMonth = (imp: any): string => {
    return imp.created_at?.slice(0, 7) || "";
  };

  const handleRevert = (importId: string) => {
    revertImport.mutate(importId);
    setConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Section A: Import History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Histórico de Importações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {importsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp: any) => {
                  const ym = getImportYearMonth(imp);
                  const closed = isMonthClosed(ym);
                  const isReverted = imp.status === "reverted";
                  return (
                    <TableRow key={imp.id} className={isReverted ? "opacity-50" : ""}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {imp.file_name || "—"}
                      </TableCell>
                      <TableCell>
                        {imp.created_at
                          ? format(new Date(imp.created_at), "dd/MM/yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{imp.row_count ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={isReverted ? "outline" : imp.status === "completed" ? "default" : "secondary"}>
                          {isReverted ? "Revertido" : imp.status === "completed" ? "Importado" : imp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{ym}</span>
                          {closed && <Lock className="h-3.5 w-3.5 text-destructive" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isReverted && imp.status === "completed" && (
                          closed ? (
                            <Button variant="ghost" size="sm" disabled title="Período fechado">
                              <Lock className="h-4 w-4 mr-1" /> Bloqueado
                            </Button>
                          ) : (
                            <AlertDialog open={confirmId === imp.id} onOpenChange={(open) => !open && setConfirmId(null)}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmId(imp.id)}>
                                  <Undo2 className="h-4 w-4 mr-1" /> Desfazer
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Desfazer importação</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Isso excluirá permanentemente todos os {imp.row_count} lançamentos importados do arquivo "{imp.file_name}".
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleRevert(imp.id)}
                                  >
                                    Confirmar exclusão
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section B: Fiscal Periods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Períodos Fiscais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {months.map((ym) => {
              const closed = isMonthClosed(ym);
              const hasImports = (importsByMonth[ym] || 0) > 0;
              const [y, m] = ym.split("-");
              const label = format(new Date(Number(y), Number(m) - 1, 1), "MMM yyyy", { locale: ptBR });

              return (
                <div
                  key={ym}
                  className={`rounded-lg border p-3 text-center space-y-2 ${
                    closed ? "border-destructive/30 bg-destructive/5" : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium capitalize">{label}</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <Badge variant={closed ? "destructive" : "default"} className="text-xs">
                      {closed ? "Fechado" : "Aberto"}
                    </Badge>
                  </div>
                  {!hasImports && (
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Sem importação</span>
                    </div>
                  )}
                  <div>
                    {closed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => reopenPeriod.mutate(ym)}
                        disabled={reopenPeriod.isPending}
                      >
                        <Unlock className="h-3 w-3 mr-1" /> Reabrir
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => closePeriod.mutate(ym)}
                        disabled={closePeriod.isPending}
                      >
                        <Lock className="h-3 w-3 mr-1" /> Fechar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
