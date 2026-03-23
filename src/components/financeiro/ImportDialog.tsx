import { useRef, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
} from "lucide-react";
import {
  useFinanceiroImport,
  TARGET_FIELDS,
  type ImportStep,
} from "@/hooks/useFinanceiroImport";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { detectImportDuplicates } from "@/hooks/useDuplicateDetection";
import { cn } from "@/lib/utils";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "saida" | "entrada";
}

const STEP_LABELS: Record<ImportStep, string> = {
  upload: "Upload",
  detecting: "Detectando",
  mapping: "Mapeamento",
  preview: "Preview",
  importing: "Importando",
  done: "Concluído",
};

export function ImportDialog({ open, onOpenChange, tipo }: ImportDialogProps) {
  const imp = useFinanceiroImport(tipo);
  const { entries: existingEntries } = useFinanceiro(tipo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Detect duplicates between imported rows and existing entries
  const duplicateIndices = useMemo(() => {
    if (imp.step !== "preview" || imp.parsedRows.length === 0) return new Set<number>();
    const rows = imp.parsedRows.map((r) => r.mapped);
    return detectImportDuplicates(rows, existingEntries);
  }, [imp.step, imp.parsedRows, existingEntries]);
  const handleClose = (o: boolean) => {
    if (!o) imp.reset();
    onOpenChange(o);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      return;
    }
    imp.parseFile(file);
  };

  const requiredMapped = TARGET_FIELDS.filter((f) => f.required).every((f) =>
    imp.mappings.some((m) => m.target_field === f.value)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar {tipo === "saida" ? "Despesas" : "Receitas"}
          </DialogTitle>
          <DialogDescription>
            Importe lançamentos a partir de arquivo CSV ou XLSX
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {(["upload", "mapping", "preview", "done"] as ImportStep[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="h-3 w-3" />}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full",
                  imp.step === s && "bg-primary text-primary-foreground font-medium",
                  imp.step !== s && "text-muted-foreground"
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </span>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {/* STEP: Upload */}
          {imp.step === "upload" && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Arraste um arquivo CSV ou XLSX aqui</p>
              <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {/* STEP: Detecting */}
          {imp.step === "detecting" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando estrutura do arquivo com IA...</p>
              <p className="text-xs text-muted-foreground">{imp.fileName}</p>
            </div>
          )}

          {/* STEP: Mapping */}
          {imp.step === "mapping" && (
            <div className="space-y-4">
              {imp.detectedFormat && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Separador: {imp.detectedFormat.separator === ";" ? "ponto-e-vírgula" : imp.detectedFormat.separator === "," ? "vírgula" : "tab"}</Badge>
                  <Badge variant="outline">Data: {imp.detectedFormat.date_format}</Badge>
                  <Badge variant="outline">Números: {imp.detectedFormat.number_format === "br" ? "Brasileiro (1.234,56)" : "US (1,234.56)"}</Badge>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Revise o mapeamento sugerido. Campos com confiança baixa estão destacados.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Coluna do arquivo (DE)</TableHead>
                    <TableHead className="w-[15%]">Confiança</TableHead>
                    <TableHead className="w-[45%]">Campo do sistema (PARA)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imp.mappings.map((m) => (
                    <TableRow
                      key={m.source_column}
                      className={cn(m.confidence === "low" && "bg-yellow-50 dark:bg-yellow-950/20")}
                    >
                      <TableCell className="font-mono text-xs">{m.source_column}</TableCell>
                      <TableCell>
                        <Badge
                          variant={m.confidence === "high" ? "default" : m.confidence === "medium" ? "secondary" : "destructive"}
                          className="text-[10px]"
                        >
                          {m.confidence === "high" ? "Alta" : m.confidence === "medium" ? "Média" : "Baixa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.target_field}
                          onValueChange={(v) => imp.updateMapping(m.source_column, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label} {f.required && "*"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!requiredMapped && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Campos obrigatórios não mapeados:{" "}
                  {TARGET_FIELDS.filter(f => f.required && !imp.mappings.some(m => m.target_field === f.value)).map(f => f.label).join(", ")}
                </p>
              )}

              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={imp.reset}>
                  Voltar
                </Button>
                <Button size="sm" onClick={imp.buildPreview} disabled={!requiredMapped}>
                  Próximo: Preview <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Preview */}
          {imp.step === "preview" && (
            <div className="space-y-4">
              {imp.error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {imp.error}
                </div>
              )}

              <div className="flex gap-3 text-xs">
                <Badge variant="outline">{imp.parsedRows.length} linhas totais</Badge>
                <Badge variant="default">{imp.parsedRows.filter((r) => r.errors.length === 0).length} válidas</Badge>
                {imp.parsedRows.some((r) => r.errors.length > 0) && (
                  <Badge variant="destructive">{imp.parsedRows.filter((r) => r.errors.length > 0).length} com erros</Badge>
                )}
                {duplicateIndices.size > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                    <Copy className="h-3 w-3 mr-1" />
                    {duplicateIndices.size} possíveis duplicatas
                  </Badge>
                )}
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data Venc.</TableHead>
                      <TableHead>Data Pgto.</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imp.parsedRows.slice(0, 20).map((r, i) => {
                      const isDup = duplicateIndices.has(i);
                      return (
                        <TableRow key={i} className={cn(r.errors.length > 0 && "bg-destructive/5", isDup && r.errors.length === 0 && "bg-amber-50/50 dark:bg-amber-950/10")}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{r.mapped.descricao || "—"}</TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {r.mapped.valor_previsto != null
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(r.mapped.valor_previsto)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{r.mapped.data_prevista || "—"}</TableCell>
                          <TableCell className="text-xs">{r.mapped.data_realizada || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{r.mapped.entity_name || "—"}</TableCell>
                          <TableCell>
                            {r.errors.length > 0 ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="destructive" className="text-[10px]">Erro</Badge>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">{r.errors.join("; ")}</p></TooltipContent>
                              </Tooltip>
                            ) : isDup ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                    <Copy className="h-2.5 w-2.5 mr-0.5" /> Duplicata?
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Lançamento similar já existe no sistema</p></TooltipContent>
                              </Tooltip>
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {imp.parsedRows.length > 20 && (
                <p className="text-xs text-muted-foreground text-center">
                  Mostrando 20 de {imp.parsedRows.length} linhas
                </p>
              )}

              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={() => imp.goToMapping()}>
                  Voltar
                </Button>
                <Button
                  size="sm"
                  onClick={imp.executeImport}
                  disabled={imp.parsedRows.filter((r) => r.errors.length === 0).length === 0}
                >
                  Importar {imp.parsedRows.filter((r) => r.errors.length === 0).length} lançamentos
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Importing */}
          {imp.step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importando lançamentos...</p>
            </div>
          )}

          {/* STEP: Done */}
          {imp.step === "done" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-medium">{imp.importCount} lançamentos importados</p>
              <p className="text-sm text-muted-foreground">Os dados foram adicionados à lista de {tipo === "saida" ? "contas a pagar" : "contas a receber"}.</p>
              <Button size="sm" onClick={() => handleClose(false)} className="mt-4">
                Fechar
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
