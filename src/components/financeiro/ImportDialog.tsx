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
  Clock,
  Info,
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
    imp.mappings.some((m) => m.target_field === f.value && m.source_column)
  );

  // Build lookup: for each rawHeader, what target is it mapped to?
  const headerToTarget: Record<string, string> = {};
  imp.mappings.forEach((m) => {
    if (m.source_column) headerToTarget[m.source_column] = m.target_field;
  });

  // Unmapped target fields (not assigned to any source column)
  const unmappedFields = TARGET_FIELDS.filter(
    (f) => f.value !== "ignorar" && !imp.mappings.some((m) => m.target_field === f.value && m.source_column)
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

              {/* SECTION 1 — File columns (DE → PARA) */}
              <div>
                <p className="text-sm font-medium mb-2">Colunas detectadas no arquivo</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Coluna do arquivo (DE)</TableHead>
                      <TableHead className="w-[15%]">Confiança</TableHead>
                      <TableHead className="w-[40%]">Campo do sistema (PARA)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imp.rawHeaders.map((header) => {
                      const mapping = imp.mappings.find((m) => m.source_column === header);
                      const currentTarget = mapping?.target_field || "ignorar";
                      const confidence = mapping?.confidence;
                      return (
                        <TableRow key={header}>
                          <TableCell className="text-xs font-medium font-mono">{header}</TableCell>
                          <TableCell>
                            {confidence ? (
                              <Badge
                                variant={confidence === "high" ? "default" : confidence === "medium" ? "secondary" : "destructive"}
                                className="text-[10px]"
                              >
                                {confidence === "high" ? "✓ Alta" : confidence === "medium" ? "~ Média" : "⚠ Baixa"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={currentTarget}
                              onValueChange={(v) => {
                                // If previously mapped, clear old target
                                if (mapping?.target_field && mapping.target_field !== "ignorar") {
                                  imp.updateMappingByTarget(mapping.target_field, "");
                                }
                                // Set new target
                                if (v !== "ignorar") {
                                  imp.updateMappingByTarget(v, header);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ignorar">— Ignorar —</SelectItem>
                                {TARGET_FIELDS.filter((f) => f.value !== "ignorar").map((f) => (
                                  <SelectItem key={f.value} value={f.value}>
                                    {f.label}{f.required ? " *" : ""}
                                  </SelectItem>
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

              {/* SECTION 2 — Unmapped fields */}
              {unmappedFields.length > 0 && (
                <div className="border border-amber-300/50 dark:border-amber-700/50 rounded-lg p-4 space-y-3 bg-amber-50/30 dark:bg-amber-950/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Campos ainda não mapeados
                    </p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Campo</TableHead>
                        <TableHead className="w-[40%]">Atribuir coluna</TableHead>
                        <TableHead className="w-[20%]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedFields.map((field) => {
                        const isDeferred = imp.deferredFields.includes(field.value);
                        const canDefer = !field.required;
                        return (
                          <TableRow key={field.value} className={cn(field.required && "bg-amber-100/40 dark:bg-amber-950/20")}>
                            <TableCell className="text-xs font-medium">
                              {field.label}
                              {field.required && (
                                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">Obrigatório</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {!isDeferred ? (
                                <Select
                                  value="__none__"
                                  onValueChange={(v) => {
                                    if (v !== "__none__") imp.updateMappingByTarget(field.value, v);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Selecione —</SelectItem>
                                    {imp.rawHeaders
                                      .filter((h) => !headerToTarget[h] || headerToTarget[h] === "ignorar")
                                      .map((h) => (
                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Será ajustado depois
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {canDefer && (
                                <Button
                                  variant={isDeferred ? "secondary" : "ghost"}
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => imp.toggleDeferred(field.value)}
                                >
                                  {isDeferred ? "Desfazer" : "Ajustar depois"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {imp.deferredFields.length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-background/60 rounded-md p-3">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <span>
                        Os campos marcados como "Ajustar depois" poderão ser completados diretamente nos lançamentos importados via{" "}
                        <strong>Contas a Pagar</strong>, <strong>Aging List</strong>, <strong>Fluxo de Caixa</strong> ou <strong>Conciliação</strong>.
                      </span>
                    </div>
                  )}
                </div>
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
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-medium">{imp.importCount} lançamentos importados</p>
              <p className="text-sm text-muted-foreground">Os dados foram adicionados à lista de {tipo === "saida" ? "contas a pagar" : "contas a receber"}.</p>

              {imp.deferredFields.length > 0 && (
                <div className="mt-3 w-full max-w-md border border-amber-300/50 dark:border-amber-700/50 rounded-lg p-4 bg-amber-50/30 dark:bg-amber-950/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Campos para ajustar</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Os seguintes campos não foram mapeados e precisam ser completados diretamente nos lançamentos:
                  </p>
                  <ul className="text-xs space-y-1">
                    {imp.deferredFields.map((df) => {
                      const label = TARGET_FIELDS.find((f) => f.value === df)?.label || df;
                      return <li key={df} className="flex items-center gap-1.5">• {label}</li>;
                    })}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Ajuste via <strong>Contas a Pagar</strong>, <strong>Aging List</strong>, <strong>Fluxo de Caixa</strong> ou <strong>Conciliação</strong>.
                  </p>
                </div>
              )}

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
