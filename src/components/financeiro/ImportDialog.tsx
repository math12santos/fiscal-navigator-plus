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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
  Download,
  Lightbulb,
  XCircle,
  Pencil,
} from "lucide-react";
import {
  useFinanceiroImport,
  TARGET_FIELDS,
  type ImportStep,
  type ParsedRow,
} from "@/hooks/useFinanceiroImport";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { detectImportDuplicates } from "@/hooks/useDuplicateDetection";
import { summarizeRowErrors } from "@/hooks/financeiroImportErrors";
import { EntityMatchingStep } from "./EntityMatchingStep";
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
  entity_matching: "Cadastros",
  importing: "Importando",
  done: "Concluído",
};

export function ImportDialog({ open, onOpenChange, tipo }: ImportDialogProps) {
  const imp = useFinanceiroImport(tipo);
  const { entries: existingEntries } = useFinanceiro(tipo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<"all" | "errors" | "valid">("all");
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

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

  const showFooter = ["mapping", "preview", "entity_matching"].includes(imp.step);

  const hasEntityNames = imp.parsedRows.some(
    (r, i) => r.errors.length === 0 && !imp.excludedRows.has(i) && (r.mapped.entity_name || "").toString().trim() !== ""
  );

  const handleAdvanceFromPreview = async () => {
    if (!hasEntityNames) {
      imp.executeImport();
      return;
    }
    const opened = await imp.prepareEntityMatching();
    if (!opened) imp.executeImport();
  };

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
            {(["upload", "mapping", "preview", "entity_matching", "done"] as ImportStep[]).map((s, i) => (
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

                {/* ── Painel de erros agrupados com soluções e quick-fixes ── */}
                {errorCount > 0 && (() => {
                  const errorRows = imp.parsedRows.filter((r) => r.errors.length > 0);
                  const summary = summarizeRowErrors(errorRows);
                  const handleQuickFix = (qf: string | null | undefined) => {
                    if (!qf) return;
                    if (qf === "switch_date_to_us") imp.setDateFormat("MM/dd/yyyy");
                    else if (qf === "switch_date_to_br") imp.setDateFormat("dd/MM/yyyy");
                    else if (qf === "switch_number_to_us") imp.setNumberFormat("us");
                    else if (qf === "switch_number_to_br") imp.setNumberFormat("br");
                    else if (qf === "open_mapping") imp.goToMapping();
                    if (["switch_date_to_us","switch_date_to_br","switch_number_to_us","switch_number_to_br"].includes(qf)) {
                      // Refaz preview com novo formato
                      setTimeout(() => imp.buildPreview(), 0);
                    }
                  };
                  return (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        Como corrigir os {errorCount} erro{errorCount > 1 ? "s" : ""} encontrado{errorCount > 1 ? "s" : ""}
                      </div>
                      <div className="space-y-2">
                        {summary.map((s) => (
                          <div key={s.info.code} className="rounded border bg-background p-2.5 text-xs space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-medium text-sm flex items-center gap-2">
                                  <Badge variant="destructive" className="text-[10px]">{s.count}×</Badge>
                                  {s.info.title}
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  <span className="font-medium text-foreground">Causa:</span> {s.info.cause}
                                </div>
                                <div className="mt-0.5 text-muted-foreground flex items-start gap-1">
                                  <Lightbulb className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                                  <span><span className="font-medium text-foreground">Solução:</span> {s.info.solution}</span>
                                </div>
                                {s.sampleRows.length > 0 && (
                                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                                    Exemplos: linha{s.sampleRows.length > 1 ? "s" : ""} {s.sampleRows.join(", ")}
                                  </div>
                                )}
                              </div>
                              {s.info.quickFix && s.info.quickFixLabel && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs shrink-0"
                                  onClick={() => handleQuickFix(s.info.quickFix)}
                                >
                                  {s.info.quickFixLabel}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
                                <div className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => setEditingRowIndex(i)}
                                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-destructive/15 hover:bg-destructive/25 transition-colors"
                                        aria-label="Corrigir linha"
                                      >
                                        <Badge variant="destructive" className="text-[10px] pointer-events-none">
                                          {r.errors.length} erro{r.errors.length > 1 ? "s" : ""}
                                        </Badge>
                                        <Pencil className="h-3 w-3 text-destructive" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="text-[11px] font-medium mb-1">Clique para corrigir:</p>
                                      <ul className="text-xs list-disc pl-3 space-y-0.5">
                                        {r.errors.map((e, ei) => <li key={ei}>{e}</li>)}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
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

          {/* STEP: Entity Matching */}
          {imp.step === "entity_matching" && (
            <EntityMatchingStep
              matches={imp.entityMatches}
              tipo={tipo}
              onConfirmPossible={imp.confirmPossibleMatch}
              onSelectEntity={imp.selectEntityForMatch}
              onIgnore={imp.ignoreEntityMatch}
              onCreateAllNew={imp.createMissingEntities}
            />
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
            <div className="flex flex-col items-center justify-center py-12 gap-4 max-w-2xl mx-auto">
              {imp.failedRows.length === 0 ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-amber-500" />
              )}
              <p className="text-lg font-medium">
                {imp.failedRows.length === 0 ? "Importação concluída" : "Importação concluída com avisos"}
              </p>

              {/* Resumo detalhado X / Y / Z */}
              <div className="grid grid-cols-3 gap-3 w-full">
                <div className="rounded-md border bg-emerald-500/10 p-3 text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                  <div className="text-2xl font-bold tabular-nums">{imp.importCount}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Importados</div>
                </div>
                <div className="rounded-md border bg-amber-500/10 p-3 text-center">
                  <Copy className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                  <div className="text-2xl font-bold tabular-nums">{imp.skippedCount}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Duplicatas puladas</div>
                </div>
                <div className={cn(
                  "rounded-md border p-3 text-center",
                  imp.failedRows.length > 0 ? "bg-destructive/10" : "bg-muted/40"
                )}>
                  <XCircle className={cn(
                    "h-5 w-5 mx-auto mb-1",
                    imp.failedRows.length > 0 ? "text-destructive" : "text-muted-foreground"
                  )} />
                  <div className="text-2xl font-bold tabular-nums">{imp.failedRows.length}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Falharam</div>
                </div>
              </div>

              {imp.skippedCount > 0 && (
                <p className="text-xs text-muted-foreground text-center max-w-md">
                  Duplicatas detectadas dentro do arquivo, contra importações anteriores ou pela proteção do banco de dados foram puladas automaticamente.
                </p>
              )}

              {imp.failedRows.length > 0 && (
                <div className="w-full rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {imp.failedRows.length} linha{imp.failedRows.length > 1 ? "s" : ""} não pôde ser importada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Baixe o CSV abaixo com apenas as linhas que falharam (com a coluna <strong>_erro</strong> explicando o motivo), corrija no Excel e reimporte.
                  </p>
                  <Button size="sm" variant="outline" onClick={imp.downloadFailedRowsCSV} className="w-full">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Baixar CSV das falhas
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground max-w-md text-center">
                Verifique a aba <strong>Aglutinação</strong> para revisar categorias e padrões importados que ainda não existem na estrutura do sistema.
              </p>
              <Button size="sm" onClick={() => handleClose(false)} className="mt-2">
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
                    onClick={handleAdvanceFromPreview}
                    disabled={validCount === 0}
                  >
                    {hasEntityNames ? (
                      <>Próximo: Cadastros <ArrowRight className="h-3 w-3 ml-1" /></>
                    ) : (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Importar {validCount} lançamentos</>
                    )}
                  </Button>
                </>
              )}
              {imp.step === "entity_matching" && (
                <>
                  <Button variant="outline" size="sm" onClick={imp.goToPreview}>
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Voltar ao Preview
                  </Button>
                  <Button size="sm" onClick={imp.executeImport} disabled={validCount === 0}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Importar {validCount} lançamentos
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* Editor inline de linha com erro */}
      <RowErrorEditor
        row={editingRowIndex != null ? imp.parsedRows[editingRowIndex] ?? null : null}
        index={editingRowIndex}
        onClose={() => setEditingRowIndex(null)}
        onSave={(idx, patch) => {
          imp.updateParsedRow(idx, patch);
          setEditingRowIndex(null);
        }}
      />
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor inline para linhas com erro no preview
// ─────────────────────────────────────────────────────────────────────────────
interface RowErrorEditorProps {
  row: ParsedRow | null;
  index: number | null;
  onClose: () => void;
  onSave: (index: number, patch: Partial<ParsedRow["mapped"]>) => void;
}

function RowErrorEditor({ row, index, onClose, onSave }: RowErrorEditorProps) {
  const open = row != null && index != null;

  // Estado local controlado, reinicializado ao abrir uma nova linha
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [dataRealizada, setDataRealizada] = useState("");
  const [entityName, setEntityName] = useState("");

  // Reset ao trocar de linha
  useMemo(() => {
    if (row) {
      setDescricao(String(row.mapped.descricao ?? ""));
      setValor(
        row.mapped.valor_previsto != null && !Number.isNaN(row.mapped.valor_previsto)
          ? String(row.mapped.valor_previsto).replace(".", ",")
          : ""
      );
      setDataPrevista(String(row.mapped.data_prevista ?? ""));
      setDataRealizada(String(row.mapped.data_realizada ?? ""));
      setEntityName(String(row.mapped.entity_name ?? ""));
    }
  }, [row]);

  const summary = row ? summarizeRowErrors([row]) : [];

  const handleSave = () => {
    if (index == null) return;
    // Converte valor BR -> número
    const cleaned = valor.replace(/\./g, "").replace(",", ".").trim();
    const valorNum = cleaned ? Number(cleaned) : null;

    onSave(index, {
      descricao: descricao.trim() || null,
      valor_previsto: valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
      data_prevista: dataPrevista.trim() || null,
      data_realizada: dataRealizada.trim() || null,
      entity_name: entityName.trim() || null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Corrigir linha {index != null ? index + 1 : ""}</SheetTitle>
          <SheetDescription>
            Edite os campos para resolver os erros. A linha não será excluída — ao salvar, a importação a reavalia automaticamente.
          </SheetDescription>
        </SheetHeader>

        {row && (
          <div className="space-y-5 py-5">
            {/* Painel de problemas detectados */}
            {summary.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-xs font-semibold text-destructive">Problemas detectados</p>
                </div>
                <ul className="space-y-2">
                  {summary.map((s, i) => (
                    <li key={i} className="text-xs space-y-0.5">
                      <p className="font-medium">{s.info.title}</p>
                      {s.info.solution && (
                        <p className="text-muted-foreground flex items-start gap-1">
                          <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{s.info.solution}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-descricao" className="text-xs">Descrição *</Label>
              <Input
                id="edit-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição do lançamento"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-valor" className="text-xs">Valor (R$) *</Label>
                <Input
                  id="edit-valor"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="1.234,56"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-fornecedor" className="text-xs">Fornecedor / Cliente</Label>
                <Input
                  id="edit-fornecedor"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="Nome"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dt-venc" className="text-xs">Data Vencimento *</Label>
                <Input
                  id="edit-dt-venc"
                  type="date"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                  maxLength={10}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-dt-pgto" className="text-xs">Data Pagamento</Label>
                <Input
                  id="edit-dt-pgto"
                  type="date"
                  value={dataRealizada}
                  onChange={(e) => setDataRealizada(e.target.value)}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Linha original do arquivo
              </p>
              <p className="text-[11px] font-mono text-muted-foreground line-clamp-3 break-all">
                {Object.entries(row.raw)
                  .filter(([, v]) => v && String(v).trim())
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            </div>
          </div>
        )}

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Salvar e revalidar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
