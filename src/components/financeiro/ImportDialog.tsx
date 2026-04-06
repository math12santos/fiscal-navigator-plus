import { useRef, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Copy,
  EyeOff,
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
  const [previewFilter, setPreviewFilter] = useState<"all" | "errors" | "valid">("all");

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
    if (!["csv", "xlsx", "xls"].includes(ext || "")) return;
    imp.parseFile(file);
  };

  const requiredMapped = TARGET_FIELDS.filter((f) => f.required).every((f) =>
    imp.mappings.some((m) => m.target_field === f.value && m.source_column)
  );

  const validCount = imp.parsedRows.filter((r, i) => r.errors.length === 0 && !imp.excludedRows.has(i)).length;
  const errorCount = imp.parsedRows.filter((r) => r.errors.length > 0).length;
  const excludedCount = imp.excludedRows.size;

  const showFooter = ["mapping", "preview"].includes(imp.step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-7xl h-[92vh] p-0 overflow-hidden flex flex-col">
        {/* ── FIXED HEADER ── */}
        <div className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Importar {tipo === "saida" ? "Despesas" : "Receitas"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Importe lançamentos a partir de arquivo CSV ou XLSX
          </p>

          {/* Step indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
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
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
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
                Revise o mapeamento sugerido. Selecione a coluna do arquivo correspondente a cada campo.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Campo do sistema</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[45%]">Coluna do arquivo (DE)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TARGET_FIELDS.filter((f) => f.value !== "ignorar").map((field) => {
                    const mapping = imp.mappings.find((m) => m.target_field === field.value);
                    const hasSource = !!mapping?.source_column;
                    const isMissing = field.required && !hasSource;
                    return (
                      <TableRow
                        key={field.value}
                        className={cn(isMissing && "bg-amber-50/60 dark:bg-amber-950/20")}
                      >
                        <TableCell className="text-xs font-medium">
                          {field.label}
                          {field.required && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">Obrigatório</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasSource && mapping?.confidence ? (
                            <Badge
                              variant={mapping.confidence === "high" ? "default" : mapping.confidence === "medium" ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >
                              {mapping.confidence === "high" ? "✓ Alta" : mapping.confidence === "medium" ? "~ Média" : "⚠ Baixa"}
                            </Badge>
                          ) : isMissing ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping?.source_column ?? "__none__"}
                            onValueChange={(v) => imp.updateMappingByTarget(field.value, v === "__none__" ? "" : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Não importar —</SelectItem>
                              {imp.rawHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* STEP: Preview */}
          {imp.step === "preview" && (() => {
            const filteredRows = imp.parsedRows
              .map((r, i) => ({ ...r, originalIndex: i }))
              .filter((r) => {
                if (previewFilter === "errors") return r.errors.length > 0;
                if (previewFilter === "valid") return r.errors.length === 0;
                return true;
              });

            return (
              <div className="space-y-4">
                {imp.error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {imp.error}
                  </div>
                )}

                {/* Summary badges as clickable filters */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => setPreviewFilter("all")}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
                      previewFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {imp.parsedRows.length} linhas totais
                  </button>
                  <button
                    onClick={() => setPreviewFilter("valid")}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
                      previewFilter === "valid" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {validCount} válidas
                  </button>
                  {errorCount > 0 && (
                    <button
                      onClick={() => setPreviewFilter("errors")}
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
                        previewFilter === "errors" ? "bg-destructive text-destructive-foreground" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      )}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {errorCount} com erros
                    </button>
                  )}
                  {excludedCount > 0 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <EyeOff className="h-3 w-3 mr-1" />
                      {excludedCount} excluídas
                    </Badge>
                  )}
                  {duplicateIndices.size > 0 && (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                      <Copy className="h-3 w-3 mr-1" />
                      {duplicateIndices.size} possíveis duplicatas
                    </Badge>
                  )}
                </div>

                <div className="border rounded-md overflow-auto max-h-[calc(92vh-280px)]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px]">Incl.</span>
                            </TooltipTrigger>
                            <TooltipContent>Incluir na importação</TooltipContent>
                          </Tooltip>
                        </TableHead>
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
                      {filteredRows.map((r) => {
                        const i = r.originalIndex;
                        const isDup = duplicateIndices.has(i);
                        const isExcluded = imp.excludedRows.has(i);
                        const hasErrors = r.errors.length > 0;
                        return (
                          <TableRow
                            key={i}
                            className={cn(
                              hasErrors && "bg-destructive/5",
                              isDup && !hasErrors && "bg-amber-50/50 dark:bg-amber-950/10",
                              isExcluded && "opacity-40"
                            )}
                          >
                            <TableCell className="px-2">
                              <Checkbox
                                checked={!isExcluded && !hasErrors}
                                disabled={hasErrors}
                                onCheckedChange={() => imp.toggleRowExclusion(i)}
                                className="h-3.5 w-3.5"
                              />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="text-xs max-w-[180px] truncate">{r.mapped.descricao || "—"}</TableCell>
                            <TableCell className="text-xs tabular-nums">
                              {r.mapped.valor_previsto != null
                                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(r.mapped.valor_previsto)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{r.mapped.data_prevista || "—"}</TableCell>
                            <TableCell className="text-xs">{r.mapped.data_realizada || "—"}</TableCell>
                            <TableCell className="text-xs max-w-[130px] truncate">{r.mapped.entity_name || "—"}</TableCell>
                            <TableCell>
                              {hasErrors ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="destructive" className="text-[10px]">
                                      {r.errors.length} erro{r.errors.length > 1 ? "s" : ""}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <ul className="text-xs list-disc pl-3 space-y-0.5">
                                      {r.errors.map((e, ei) => <li key={ei}>{e}</li>)}
                                    </ul>
                                  </TooltipContent>
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
                              ) : isExcluded ? (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">Excluída</Badge>
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

                {filteredRows.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center">
                    {filteredRows.length} linhas {previewFilter !== "all" ? "(filtradas)" : ""}
                  </p>
                )}
              </div>
            );
          })()}

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
              <p className="text-xs text-muted-foreground max-w-md text-center mt-1">
                Verifique a aba <strong>Aglutinação</strong> para revisar categorias e padrões importados que ainda não existem na estrutura do sistema.
              </p>
              <Button size="sm" onClick={() => handleClose(false)} className="mt-4">
                Fechar
              </Button>
            </div>
          )}
        </div>

        {/* ── FIXED FOOTER ── */}
        {showFooter && (
          <div className="shrink-0 border-t bg-background px-6 py-4">
            <div className="flex justify-between items-center">
              {imp.step === "mapping" && (
                <>
                  <Button variant="outline" size="sm" onClick={imp.reset}>
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Voltar
                  </Button>
                  <Button size="sm" onClick={imp.buildPreview} disabled={!requiredMapped}>
                    Próximo: Preview <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
              {imp.step === "preview" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setPreviewFilter("all"); imp.goToMapping(); }}>
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Voltar ao Mapeamento
                  </Button>
                  <Button
                    size="sm"
                    onClick={imp.executeImport}
                    disabled={validCount === 0}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Importar {validCount} lançamentos
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
