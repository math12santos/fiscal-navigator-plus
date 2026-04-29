import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, Loader2, FileSpreadsheet, ArrowRight, ArrowLeft,
  CheckCircle2, AlertTriangle, EyeOff, Download, Lightbulb, XCircle, Landmark,
} from "lucide-react";
import {
  useBankStatementImport, STATEMENT_TARGET_FIELDS, type StatementImportStep,
} from "@/hooks/useBankStatementImport";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { summarizeRowErrors } from "@/hooks/financeiroImportErrors";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBankAccountId?: string | null;
}

const STEP_LABELS: Record<StatementImportStep, string> = {
  upload: "Upload",
  detecting: "Detectando",
  mapping: "Mapeamento",
  preview: "Preview",
  importing: "Importando",
  done: "Concluído",
};

export function BankStatementImportDialog({ open, onOpenChange, defaultBankAccountId }: Props) {
  const imp = useBankStatementImport();
  const { bankAccounts: accounts } = useBankAccounts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<"all" | "errors" | "valid">("all");

  // Pré-seleciona conta vinda do contexto (se houver) na primeira render
  if (defaultBankAccountId && imp.bankAccountId !== defaultBankAccountId && imp.step === "upload" && !imp.bankAccountId) {
    imp.setBankAccountId(defaultBankAccountId);
  }

  const handleClose = (o: boolean) => {
    if (!o) imp.reset();
    onOpenChange(o);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) return;
    if (!imp.bankAccountId) return;
    imp.parseFile(file);
  };

  const requiredMapped = STATEMENT_TARGET_FIELDS.filter((f) => f.required).every((f) =>
    imp.mappings.some((m) => m.target_field === f.value && m.source_column)
  );

  const validCount = imp.parsedRows.filter((r, i) => r.errors.length === 0 && !imp.excludedRows.has(i)).length;
  const errorCount = imp.parsedRows.filter((r) => r.errors.length > 0).length;
  const excludedCount = imp.excludedRows.size;
  const showFooter = ["mapping", "preview"].includes(imp.step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-7xl h-[92vh] p-0 overflow-hidden flex flex-col">
        <div className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Importar Extrato Bancário
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Importe linhas do extrato (CSV ou XLSX) para conciliar com lançamentos do fluxo de caixa
          </p>

          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
            {(["upload", "mapping", "preview", "done"] as StatementImportStep[]).map((s, i) => (
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

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {imp.step === "upload" && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5" />
                  Conta bancária deste extrato
                </label>
                <Select
                  value={imp.bankAccountId ?? ""}
                  onValueChange={(v) => imp.setBankAccountId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta bancária..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.active).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome} {a.banco ? `(${a.banco})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Cada extrato é vinculado a uma conta. Para importar de várias contas, repita o processo.
                </p>
              </div>

              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                  imp.bankAccountId ? "cursor-pointer" : "opacity-50 cursor-not-allowed",
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={(e) => { if (imp.bankAccountId) { e.preventDefault(); setDragOver(true); } }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  if (!imp.bankAccountId) return;
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => imp.bankAccountId && fileRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {imp.bankAccountId ? "Arraste um arquivo CSV ou XLSX aqui" : "Selecione uma conta bancária acima"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {imp.bankAccountId ? "ou clique para selecionar" : "Depois você poderá enviar o extrato"}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>

              {imp.error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {imp.error}
                </div>
              )}
            </div>
          )}

          {imp.step === "mapping" && (
            <div className="space-y-4">
              {imp.detectedFormat && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Data: {imp.detectedFormat.date_format}</Badge>
                  <Badge variant="outline">Números: {imp.detectedFormat.number_format === "br" ? "BR (1.234,56)" : "US (1,234.56)"}</Badge>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Indique qual coluna do arquivo corresponde a cada campo do extrato.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Campo do sistema</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[45%]">Coluna do arquivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {STATEMENT_TARGET_FIELDS.map((field) => {
                    const m = imp.mappings.find((x) => x.target_field === field.value);
                    const has = !!m?.source_column;
                    const missing = field.required && !has;
                    return (
                      <TableRow key={field.value} className={cn(missing && "bg-amber-50/60 dark:bg-amber-950/20")}>
                        <TableCell className="text-xs font-medium">
                          {field.label}
                          {field.required && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">Obrigatório</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {has ? (
                            <Badge variant="default" className="text-[10px]">✓</Badge>
                          ) : missing ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={m?.source_column ?? "__none__"}
                            onValueChange={(v) => imp.updateMappingByTarget(field.value, v === "__none__" ? "" : v)}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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

          {imp.step === "preview" && (() => {
            const filteredRows = imp.parsedRows
              .map((r, i) => ({ ...r, originalIndex: i }))
              .filter((r) => {
                if (previewFilter === "errors") return r.errors.length > 0;
                if (previewFilter === "valid") return r.errors.length === 0;
                return true;
              });

            const errorRows = imp.parsedRows.filter((r) => r.errors.length > 0);
            const summary = errorRows.length > 0 ? summarizeRowErrors(errorRows) : [];

            const handleQuickFix = (qf: string | null | undefined) => {
              if (!qf) return;
              if (qf === "switch_date_to_us") imp.setDateFormat("MM/dd/yyyy");
              else if (qf === "switch_date_to_br") imp.setDateFormat("dd/MM/yyyy");
              else if (qf === "switch_number_to_us") imp.setNumberFormat("us");
              else if (qf === "switch_number_to_br") imp.setNumberFormat("br");
              else if (qf === "open_mapping") imp.goToMapping();
              if (["switch_date_to_us","switch_date_to_br","switch_number_to_us","switch_number_to_br"].includes(qf)) {
                setTimeout(() => imp.buildPreview(), 0);
              }
            };

            return (
              <div className="space-y-4">
                {imp.error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {imp.error}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => setPreviewFilter("all")}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
                      previewFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {imp.parsedRows.length} linhas
                  </button>
                  <button
                    onClick={() => setPreviewFilter("valid")}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
                      previewFilter === "valid" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {validCount} válidas
                  </button>
                  {errorCount > 0 && (
                    <button
                      onClick={() => setPreviewFilter("errors")}
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
                        previewFilter === "errors" ? "bg-destructive text-destructive-foreground" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      )}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" /> {errorCount} erros
                    </button>
                  )}
                  {excludedCount > 0 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <EyeOff className="h-3 w-3 mr-1" /> {excludedCount} excluídas
                    </Badge>
                  )}
                </div>

                {summary.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Como corrigir os {errorCount} erro{errorCount > 1 ? "s" : ""}
                    </div>
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
                            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                              onClick={() => handleQuickFix(s.info.quickFix)}
                            >
                              {s.info.quickFixLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border rounded-md overflow-auto max-h-[calc(92vh-340px)]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10"><span className="text-[10px]">Incl.</span></TableHead>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Doc.</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => {
                        const i = r.originalIndex;
                        const isExcluded = imp.excludedRows.has(i);
                        const hasErrors = r.errors.length > 0;
                        const valor = Number(r.mapped.valor || 0);
                        return (
                          <TableRow
                            key={i}
                            className={cn(
                              hasErrors && "bg-destructive/5",
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
                            <TableCell className="text-xs">{r.mapped.data || "—"}</TableCell>
                            <TableCell className="text-xs max-w-[260px] truncate">{r.mapped.descricao || "—"}</TableCell>
                            <TableCell className={cn("text-xs tabular-nums text-right", valor < 0 ? "text-destructive" : "text-emerald-600")}>
                              {r.mapped.valor != null
                                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{r.mapped.documento || "—"}</TableCell>
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
              </div>
            );
          })()}

          {imp.step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importando linhas do extrato...</p>
            </div>
          )}

          {imp.step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 max-w-2xl mx-auto">
              {imp.failedRows.length === 0 ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-amber-500" />
              )}
              <p className="text-lg font-medium">
                {imp.failedRows.length === 0 ? "Extrato importado" : "Importação concluída com avisos"}
              </p>

              <div className="grid grid-cols-3 gap-3 w-full">
                <div className="rounded-md border bg-emerald-500/10 p-3 text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                  <div className="text-2xl font-bold tabular-nums">{imp.importCount}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Importados</div>
                </div>
                <div className="rounded-md border bg-amber-500/10 p-3 text-center">
                  <EyeOff className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                  <div className="text-2xl font-bold tabular-nums">{imp.skippedCount}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Duplicatas puladas</div>
                </div>
                <div className={cn("rounded-md border p-3 text-center",
                  imp.failedRows.length > 0 ? "bg-destructive/10" : "bg-muted/40"
                )}>
                  <XCircle className={cn("h-5 w-5 mx-auto mb-1",
                    imp.failedRows.length > 0 ? "text-destructive" : "text-muted-foreground"
                  )} />
                  <div className="text-2xl font-bold tabular-nums">{imp.failedRows.length}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Falharam</div>
                </div>
              </div>

              {imp.failedRows.length > 0 && (
                <div className="w-full rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {imp.failedRows.length} linha{imp.failedRows.length > 1 ? "s" : ""} não pôde ser importada
                  </p>
                  <Button size="sm" variant="outline" onClick={imp.downloadFailedRowsCSV} className="w-full">
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar CSV das falhas
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground max-w-md text-center">
                Agora vá para a tela de Conciliação para vincular as linhas importadas aos lançamentos do fluxo de caixa.
              </p>
              <Button size="sm" onClick={() => handleClose(false)} className="mt-2">Fechar</Button>
            </div>
          )}
        </div>

        {showFooter && (
          <div className="shrink-0 border-t bg-background px-6 py-4">
            <div className="flex justify-between items-center">
              {imp.step === "mapping" && (
                <>
                  <Button variant="outline" size="sm" onClick={imp.reset}>
                    <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
                  </Button>
                  <Button size="sm" onClick={imp.buildPreview} disabled={!requiredMapped}>
                    Próximo: Preview <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
              {imp.step === "preview" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setPreviewFilter("all"); imp.goToMapping(); }}>
                    <ArrowLeft className="h-3 w-3 mr-1" /> Voltar ao Mapeamento
                  </Button>
                  <Button size="sm" onClick={imp.executeImport} disabled={validCount === 0}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Importar {validCount} linhas
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
