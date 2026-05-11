import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { parseOfx } from "@/lib/parsers/ofxParser";
import { parsePdfStatement } from "@/lib/parsers/pdfStatementParser";

export type StatementSourceFormat = "csv" | "xlsx" | "ofx" | "pdf";

export interface CoverageResult {
  total: number;
  casado: number;
  sugestao: number;
  nao_previsto: number;
}

export type StatementImportStep = "upload" | "detecting" | "mapping" | "preview" | "importing" | "done";

export interface MappingItem {
  target_field: string;
  source_column: string | null;
  confidence: "high" | "medium" | "low" | null;
}

export interface DetectedFormat {
  separator: string;
  date_format: string;
  number_format: "br" | "us";
  mappings: MappingItem[];
}

export const STATEMENT_TARGET_FIELDS = [
  { value: "data", label: "Data", required: true },
  { value: "descricao", label: "Histórico / Descrição", required: true },
  { value: "valor", label: "Valor (positivo=crédito, negativo=débito)", required: true },
  { value: "documento", label: "Documento / Nº", required: false },
  { value: "notes", label: "Observações", required: false },
] as const;

function parseBRNumber(val: string): number {
  if (!val || !val.trim()) return 0;
  const cleaned = val.replace(/[R$\s]/g, "").trim();
  // detecta sinal de débito comum: "D" ao final, ou parênteses
  const isNeg = /\bd\b|^\(.*\)$|^-/i.test(cleaned);
  const numStr = cleaned.replace(/[()dDcC]/g, "").replace(/^-/, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  return isNeg ? -Math.abs(num) : num;
}

function parseUSNumber(val: string): number {
  if (!val || !val.trim()) return 0;
  const cleaned = val.replace(/[$\s]/g, "").trim();
  const isNeg = /^\(.*\)$|^-/.test(cleaned);
  const numStr = cleaned.replace(/[()]/g, "").replace(/^-/, "").replace(/,/g, "");
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  return isNeg ? -Math.abs(num) : num;
}

function parseBRDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const parts = val.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(val.trim())) return val.trim().slice(0, 10);
  return null;
}

function parseUSDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const parts = val.trim().split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(val.trim())) return val.trim().slice(0, 10);
  return null;
}

export interface ParsedRow {
  raw: Record<string, string>;
  mapped: Record<string, any>;
  errors: string[];
}

/** Heurística simples de auto-mapeamento por nome de coluna (sem IA) */
function autoMapHeaders(headers: string[]): MappingItem[] {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const find = (...keys: string[]) =>
    headers.find((h) => keys.some((k) => norm(h).includes(k))) ?? null;

  const dataCol = find("data", "date", "dt mov", "lançamento", "lancamento");
  const descCol = find("histor", "descri", "memo", "lancamento", "operacao");
  const valorCol = find("valor", "amount", "value", "credito", "debito");
  const docCol = find("documento", "doc", "ref");

  return STATEMENT_TARGET_FIELDS.map((f) => {
    let src: string | null = null;
    if (f.value === "data") src = dataCol;
    else if (f.value === "descricao") src = descCol;
    else if (f.value === "valor") src = valorCol;
    else if (f.value === "documento") src = docCol;
    return { target_field: f.value, source_column: src, confidence: src ? "high" : null };
  });
}

export function useBankStatementImport() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<StatementImportStep>("upload");
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null);
  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importCount, setImportCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [failedRows, setFailedRows] = useState<{ rowIndex: number; raw: Record<string, string>; error: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [sourceFormat, setSourceFormat] = useState<StatementSourceFormat | null>(null);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [lastImportId, setLastImportId] = useState<string | null>(null);
  const [ofxClosingBalance, setOfxClosingBalance] = useState<{ value: number; asOf: string | null } | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setBankAccountId(null);
    setFileName("");
    setRawHeaders([]);
    setRawRows([]);
    setDetectedFormat(null);
    setMappings([]);
    setParsedRows([]);
    setImportCount(0);
    setSkippedCount(0);
    setFailedRows([]);
    setError(null);
    setExcludedRows(new Set());
    setSourceFormat(null);
    setCoverage(null);
    setLastImportId(null);
    setOfxClosingBalance(null);
  }, []);

  const setDateFormat = useCallback((fmt: "dd/MM/yyyy" | "MM/dd/yyyy") => {
    setDetectedFormat((prev) => (prev ? { ...prev, date_format: fmt } : prev));
  }, []);

  const setNumberFormat = useCallback((fmt: "br" | "us") => {
    setDetectedFormat((prev) => (prev ? { ...prev, number_format: fmt } : prev));
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      let headers: string[] = [];
      let rows: string[][] = [];
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let format: StatementSourceFormat = "csv";
      let dateFmt: "dd/MM/yyyy" | "MM/dd/yyyy" = "dd/MM/yyyy";

      if (ext === "xlsx" || ext === "xls") {
        format = "xlsx";
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        if (data.length > 0) {
          headers = data[0].map((h) => String(h ?? "").trim());
          rows = data.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
        }
      } else if (ext === "ofx" || ext === "qfx") {
        format = "ofx";
        const text = await file.text();
        const result = parseOfx(text);
        if (result.rows.length === 0) {
          setError("OFX vazio ou inválido. Nenhum lançamento (<STMTTRN>) encontrado.");
          return;
        }
        headers = [...result.headers];
        rows = result.rows;
        setOfxClosingBalance(result.closingBalance ?? null);
        // OFX always uses ISO date and dot-decimal numbers
        dateFmt = "dd/MM/yyyy"; // not used (data is already ISO)
      } else if (ext === "pdf") {
        format = "pdf";
        const result = await parsePdfStatement(file);
        if (result.rows.length === 0) {
          setError(
            "Não foi possível extrair lançamentos do PDF. PDFs digitalizados (imagem) não são suportados — use OFX ou XLSX quando possível."
          );
          return;
        }
        headers = [...result.headers];
        rows = result.rows;
      } else {
        format = "csv";
        const text = await file.text();
        const firstLine = text.split("\n")[0] || "";
        const sep = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
        const lines = text.split("\n").filter((l) => l.trim() !== "");
        if (lines.length > 0) {
          headers = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, "").trim());
          rows = lines.slice(1).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
        }
      }

      if (headers.length === 0) {
        setError("Não foi possível ler o arquivo. Verifique o formato.");
        return;
      }

      setSourceFormat(format);
      setRawHeaders(headers);
      setRawRows(rows);
      // For OFX/PDF the parser already produces ISO dates and dot-decimal numbers
      const isPreParsed = format === "ofx" || format === "pdf";
      setDetectedFormat({
        separator: ";",
        date_format: isPreParsed ? "yyyy-MM-dd" : dateFmt,
        number_format: isPreParsed ? "us" : "br",
        mappings: [],
      });
      // For OFX/PDF, headers already match target field names → identity mapping
      if (isPreParsed) {
        setMappings(
          STATEMENT_TARGET_FIELDS.map((f) => ({
            target_field: f.value,
            source_column: headers.includes(f.value) ? f.value : null,
            confidence: headers.includes(f.value) ? ("high" as const) : null,
          }))
        );
      } else {
        setMappings(autoMapHeaders(headers));
      }
      setStep("mapping");
    } catch (e) {
      if (import.meta.env.DEV) console.error("Parse error:", e);
      setError("Erro ao processar arquivo: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }, []);

  const updateMappingByTarget = useCallback((targetField: string, sourceColumn: string) => {
    setMappings((prev) => {
      const updated = sourceColumn
        ? prev.map((m) =>
            m.source_column === sourceColumn && m.target_field !== targetField
              ? { ...m, source_column: null, confidence: null }
              : m
          )
        : prev;
      return updated.map((m) =>
        m.target_field === targetField
          ? { ...m, source_column: sourceColumn || null, confidence: sourceColumn ? ("high" as const) : null }
          : m
      );
    });
  }, []);

  const buildPreview = useCallback(() => {
    const parseNum = detectedFormat?.number_format === "us" ? parseUSNumber : parseBRNumber;
    const parseDate = detectedFormat?.date_format?.startsWith("MM") ? parseUSDate : parseBRDate;

    const fieldByHeader: Record<string, string> = {};
    mappings.forEach((m) => {
      if (m.source_column) fieldByHeader[m.source_column] = m.target_field;
    });

    const parsed: ParsedRow[] = rawRows.map((row) => {
      const rawObj: Record<string, string> = {};
      const mapped: Record<string, any> = {};
      const errors: string[] = [];

      rawHeaders.forEach((h, i) => {
        rawObj[h] = row[i] ?? "";
        const target = fieldByHeader[h];
        if (!target) return;
        const val = row[i] ?? "";
        if (target === "valor") {
          mapped[target] = parseNum(val);
          if (mapped[target] === 0 && val.trim()) errors.push(`Valor inválido: "${val}"`);
        } else if (target === "data") {
          mapped[target] = parseDate(val);
          if (!mapped[target] && val.trim()) errors.push(`Data inválida: "${val}"`);
        } else {
          mapped[target] = val.trim() || null;
        }
      });

      if (!mapped.descricao) errors.push("Descrição ausente");
      if (mapped.valor == null) errors.push("Valor ausente");
      if (!mapped.data) errors.push("Data ausente");

      return { raw: rawObj, mapped, errors };
    });

    setParsedRows(parsed);
    setStep("preview");
  }, [rawHeaders, rawRows, mappings, detectedFormat]);

  const toggleRowExclusion = useCallback((index: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const goToMapping = useCallback(() => setStep("mapping"), []);
  const goToPreview = useCallback(() => setStep("preview"), []);

  const executeImport = useCallback(async () => {
    if (!user?.id || !currentOrg?.id || !bankAccountId) {
      setError("Selecione a conta bancária antes de importar.");
      return;
    }
    setStep("importing");
    setError(null);
    setSkippedCount(0);
    setFailedRows([]);

    try {
      const validRows = parsedRows
        .map((r, i) => ({ row: r, idx: i }))
        .filter(({ row, idx }) => row.errors.length === 0 && !excludedRows.has(idx));
      if (validRows.length === 0) {
        setError("Nenhuma linha válida para importar.");
        setStep("preview");
        return;
      }

      const { data: importRecord, error: importErr } = await supabase
        .from("data_imports")
        .insert({
          organization_id: currentOrg.id,
          user_id: user.id,
          file_name: fileName,
          source_type: sourceFormat ?? "csv_xlsx",
          column_mapping: { module: "extrato_bancario", bankAccountId, format: sourceFormat } as any,
          row_count: validRows.length,
          status: "processing",
        })
        .select("id")
        .single();
      if (importErr) throw importErr;
      const importId = importRecord.id;

      // Pré-check banco para deduplicação contra importações anteriores
      const dataMin = validRows.reduce<string | null>(
        (m, { row }) => (row.mapped.data && (!m || row.mapped.data < m) ? row.mapped.data : m),
        null
      );
      const dataMax = validRows.reduce<string | null>(
        (m, { row }) => (row.mapped.data && (!m || row.mapped.data > m) ? row.mapped.data : m),
        null
      );

      const preExisting = new Set<string>();
      if (dataMin && dataMax) {
        const { data: existing } = await supabase
          .from("bank_statement_entries")
          .select("data, valor, descricao")
          .eq("organization_id", currentOrg.id)
          .eq("bank_account_id", bankAccountId)
          .gte("data", dataMin)
          .lte("data", dataMax);
        (existing || []).forEach((e: any) => {
          preExisting.add(`${e.data}|${Number(e.valor).toFixed(2)}|${(e.descricao || "").toString().trim().toLowerCase()}`);
        });
      }

      // Persist EVERY parsed row (valid + invalid + excluded) into staging.
      // Nothing is silently dropped.
      const stagingPayload = parsedRows.map((r, idx) => {
        const isExcluded = excludedRows.has(idx);
        const errs = [...r.errors];
        if (isExcluded) errs.push("Excluída pelo usuário no preview");
        return {
          organization_id: currentOrg.id,
          user_id: user.id,
          bank_account_id: bankAccountId,
          import_id: importId,
          row_index: idx,
          raw: r.raw,
          parsed: r.mapped,
          errors: errs,
          status: errs.length > 0 ? "erro_validacao" : "pendente",
        };
      });
      const { data: stagingInserted } = await supabase
        .from("bank_statement_staging" as any)
        .insert(stagingPayload as any)
        .select("id, row_index");
      const stagingIdByIdx = new Map<number, string>();
      (stagingInserted ?? []).forEach((s: any) => stagingIdByIdx.set(s.row_index, s.id));

      const intraSeen = new Set<string>();
      let skipped = 0;
      let imported = 0;
      const failed: { rowIndex: number; raw: Record<string, string>; error: string }[] = [];
      const eligible: { idx: number; raw: Record<string, string>; payload: any; stagingId?: string }[] = [];

      for (const { row, idx } of validRows) {
        const data = row.mapped.data;
        const valor = Number(row.mapped.valor || 0);
        const desc = (row.mapped.descricao || "").toString().trim();
        const k = `${data}|${valor.toFixed(2)}|${desc.toLowerCase()}`;
        if (intraSeen.has(k)) { skipped++; continue; }
        intraSeen.add(k);
        if (preExisting.has(k)) { skipped++; continue; }

        eligible.push({
          idx,
          raw: row.raw,
          stagingId: stagingIdByIdx.get(idx),
          payload: {
            organization_id: currentOrg.id,
            user_id: user.id,
            bank_account_id: bankAccountId,
            data,
            descricao: desc || "(sem descrição)",
            valor,
            documento: row.mapped.documento || null,
            notes: row.mapped.notes || null,
            import_id: importId,
            source_ref: `statement_import:${importId}:${idx}`,
            status: "pendente",
          },
        });
      }

      const batchSize = 50;
      const insertedByIdx = new Map<number, string>();
      for (let i = 0; i < eligible.length; i += batchSize) {
        const batch = eligible.slice(i, i + batchSize);
        const { data: inserted, error: batchErr } = await supabase
          .from("bank_statement_entries")
          .upsert(batch.map((b) => b.payload), {
            onConflict: "organization_id,bank_account_id,source_ref",
            ignoreDuplicates: false,
          })
          .select("id, source_ref");
        if (batchErr) {
          batch.forEach((b) => failed.push({ rowIndex: b.idx + 1, raw: b.raw, error: batchErr.message }));
          continue;
        }
        const bySrc = new Map((inserted ?? []).map((x: any) => [x.source_ref, x.id]));
        batch.forEach((b) => {
          const id = bySrc.get(b.payload.source_ref);
          if (id) {
            imported++;
            insertedByIdx.set(b.idx, id);
          } else {
            skipped++;
          }
        });
      }

      // Marca staging como "importado" e vincula a bank_statement_entry para linhas que foram inseridas.
      if (insertedByIdx.size > 0) {
        const updates = Array.from(insertedByIdx.entries()).map(([idx, bseId]) => ({
          idx,
          stagingId: stagingIdByIdx.get(idx),
          bseId,
        })).filter((u) => u.stagingId);
        await Promise.all(
          updates.map((u) =>
            supabase
              .from("bank_statement_staging" as any)
              .update({ status: "importado", bank_statement_entry_id: u.bseId } as any)
              .eq("id", u.stagingId!)
          )
        );
      }

      await supabase
        .from("data_imports")
        .update({
          status: failed.length > 0 ? "completed_with_errors" : "completed",
          imported_at: new Date().toISOString(),
        })
        .eq("id", importId);

      setImportCount(imported);
      setSkippedCount(skipped);
      setFailedRows(failed);
      setLastImportId(importId);
      setStep("done");

      // Atualiza saldo OFX (LEDGERBAL) na conta — referência de conciliação.
      // Idempotente: só sobrescreve se o DTASOF for mais recente que o atual.
      if (ofxClosingBalance && bankAccountId) {
        try {
          const { data: existingAcc } = await supabase
            .from("bank_accounts")
            .select("saldo_ofx_data")
            .eq("id", bankAccountId)
            .maybeSingle();
          const newAsOf = ofxClosingBalance.asOf;
          const currentAsOf = (existingAcc as any)?.saldo_ofx_data ?? null;
          const shouldUpdate = !currentAsOf || (newAsOf && newAsOf >= currentAsOf);
          if (shouldUpdate) {
            await supabase
              .from("bank_accounts")
              .update({
                saldo_ofx: ofxClosingBalance.value,
                saldo_ofx_data: newAsOf,
                saldo_ofx_atualizado_em: new Date().toISOString(),
                saldo_ofx_import_id: importId,
              } as any)
              .eq("id", bankAccountId);
            queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
          }
        } catch (e) {
          if (import.meta.env.DEV) console.warn("Falha ao atualizar saldo OFX da conta:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["bank-statement-entries", currentOrg.id] });

      // Run coverage classification (matches each new line against expected cashflow)
      if (imported > 0) {
        setCoverageLoading(true);
        try {
          const { data: cov, error: covErr } = await supabase.rpc(
            "classify_statement_coverage" as any,
            { p_org_id: currentOrg.id, p_import_id: importId }
          );
          if (!covErr && cov) setCoverage(cov as unknown as CoverageResult);
        } finally {
          setCoverageLoading(false);
        }
      }

      const parts = [`${imported} importados`];
      if (skipped > 0) parts.push(`${skipped} duplicatas puladas`);
      if (failed.length > 0) parts.push(`${failed.length} falharam`);
      toast({
        title: failed.length > 0 ? "Importação parcial" : "Extrato importado",
        description: parts.join(" · "),
        variant: failed.length > 0 ? "destructive" : "default",
      });
    } catch (e) {
      if (import.meta.env.DEV) console.error("Import statement error:", e);
      setError("Erro: " + (e instanceof Error ? e.message : "desconhecido"));
      setStep("preview");
    }
  }, [user, currentOrg, bankAccountId, parsedRows, excludedRows, fileName, queryClient, toast, sourceFormat]);

  const downloadFailedRowsCSV = useCallback(() => {
    if (failedRows.length === 0) return;
    const headers = [...rawHeaders, "_erro"];
    const lines = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",")];
    failedRows.forEach((f) => {
      const cells = rawHeaders.map((h) => `"${(f.raw[h] || "").toString().replace(/"/g, '""')}"`);
      cells.push(`"${f.error.replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `falhas-extrato-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [failedRows, rawHeaders]);

  return {
    step,
    bankAccountId,
    setBankAccountId,
    fileName,
    rawHeaders,
    rawRows,
    detectedFormat,
    mappings,
    parsedRows,
    importCount,
    skippedCount,
    failedRows,
    error,
    excludedRows,
    reset,
    parseFile,
    updateMappingByTarget,
    buildPreview,
    goToMapping,
    goToPreview,
    executeImport,
    toggleRowExclusion,
    setDateFormat,
    setNumberFormat,
    downloadFailedRowsCSV,
    sourceFormat,
    coverage,
    coverageLoading,
    lastImportId,
  };
}
