import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export type ImportStep = "upload" | "detecting" | "mapping" | "preview" | "importing" | "done";

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

export const TARGET_FIELDS = [
  { value: "descricao", label: "Descrição", required: true },
  { value: "valor_previsto", label: "Valor", required: true },
  { value: "data_prevista", label: "Data Vencimento", required: true },
  { value: "data_realizada", label: "Data Pagamento", required: false },
  { value: "entity_name", label: "Fornecedor / Cliente", required: false },
  { value: "categoria", label: "Categoria", required: false },
  { value: "documento", label: "Nº Documento", required: false },
  { value: "conta_bancaria_nome", label: "Conta Bancária", required: false },
  { value: "notes", label: "Observações", required: false },
  { value: "ignorar", label: "Ignorar", required: false },
] as const;

function parseBRNumber(val: string): number {
  if (!val || !val.trim()) return 0;
  const cleaned = val.replace(/[R$\s]/g, "").trim();
  // BR format: 1.234,56 → remove dots, replace comma with dot
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

function parseUSNumber(val: string): number {
  if (!val || !val.trim()) return 0;
  const cleaned = val.replace(/[$\s]/g, "").trim();
  const normalized = cleaned.replace(/,/g, "");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

function parseBRDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const parts = val.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try ISO
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

export function useFinanceiroImport(tipo: "saida" | "entrada") {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null);
  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importCount, setImportCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setRawHeaders([]);
    setRawRows([]);
    setDetectedFormat(null);
    setMappings([]);
    setParsedRows([]);
    setImportCount(0);
    setError(null);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    try {
      let headers: string[] = [];
      let rows: string[][] = [];

      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        if (data.length > 0) {
          headers = data[0].map((h) => String(h ?? "").trim());
          rows = data.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
        }
      } else {
        const text = await file.text();
        // Detect separator
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

      setRawHeaders(headers);
      setRawRows(rows);
      setStep("detecting");

      // Call AI for mapping
      const sampleRows = rows.slice(0, 5);
      const { data, error: fnError } = await supabase.functions.invoke("detect-import-mapping", {
        body: { headers, sampleRows },
      });

      // Build full mappings array keyed by TARGET_FIELDS
      const buildFullMappings = (aiMappings: { source_column: string; target_field: string; confidence: string }[]): MappingItem[] => {
        return TARGET_FIELDS
          .filter((f) => f.value !== "ignorar")
          .map((f) => {
            const aiMatch = aiMappings.find((m) => m.target_field === f.value);
            return {
              target_field: f.value,
              source_column: aiMatch?.source_column ?? null,
              confidence: aiMatch ? (aiMatch.confidence as "high" | "medium" | "low") : null,
            };
          });
      };

      if (fnError || data?.error) {
        console.error("AI mapping error:", fnError || data?.error);
        setDetectedFormat({
          separator: ";",
          date_format: "dd/MM/yyyy",
          number_format: "br",
          mappings: [],
        });
        setMappings(buildFullMappings([]));
        toast({
          title: "IA indisponível",
          description: "Mapeamento automático falhou. Configure manualmente.",
          variant: "destructive",
        });
      } else {
        const detected = data as DetectedFormat;
        setDetectedFormat(detected);
        setMappings(buildFullMappings(detected.mappings));
      }
      setStep("mapping");
    } catch (e) {
      console.error("Parse error:", e);
      setError("Erro ao processar arquivo: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }, [toast]);

  const updateMapping = useCallback((sourceColumn: string, newTarget: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.source_column === sourceColumn ? { ...m, target_field: newTarget, confidence: "high" } : m))
    );
  }, []);

  const buildPreview = useCallback(() => {
    const parseNum = detectedFormat?.number_format === "us" ? parseUSNumber : parseBRNumber;
    const parseDate = detectedFormat?.date_format?.startsWith("MM") ? parseUSDate : parseBRDate;

    const fieldByHeader: Record<string, string> = {};
    mappings.forEach((m) => {
      if (m.target_field !== "ignorar") fieldByHeader[m.source_column] = m.target_field;
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
        if (target === "valor_previsto") {
          mapped[target] = parseNum(val);
          if (mapped[target] === 0 && val.trim()) errors.push(`Valor inválido: "${val}"`);
        } else if (target === "data_prevista" || target === "data_realizada") {
          mapped[target] = parseDate(val);
          if (!mapped[target] && val.trim()) errors.push(`Data inválida: "${val}"`);
        } else {
          mapped[target] = val.trim() || null;
        }
      });

      // Validate required
      if (!mapped.descricao) errors.push("Descrição ausente");
      if (!mapped.valor_previsto && mapped.valor_previsto !== 0) errors.push("Valor ausente");
      if (!mapped.data_prevista) errors.push("Data ausente");

      return { raw: rawObj, mapped, errors };
    });

    setParsedRows(parsed);
    setStep("preview");
  }, [rawHeaders, rawRows, mappings, detectedFormat]);

  const executeImport = useCallback(async () => {
    if (!user?.id || !currentOrg?.id) return;
    setStep("importing");
    setError(null);

    try {
      const validRows = parsedRows.filter((r) => r.errors.length === 0);
      if (validRows.length === 0) {
        setError("Nenhuma linha válida para importar.");
        setStep("preview");
        return;
      }

      // Create staging record
      const fieldByHeader: Record<string, string> = {};
      mappings.forEach((m) => {
        if (m.target_field !== "ignorar") fieldByHeader[m.source_column] = m.target_field;
      });

      const { data: importRecord, error: importErr } = await supabase
        .from("data_imports")
        .insert({
          organization_id: currentOrg.id,
          user_id: user.id,
          file_name: fileName,
          source_type: "csv_xlsx",
          column_mapping: fieldByHeader as any,
          row_count: validRows.length,
          status: "processing",
        })
        .select("id")
        .single();

      if (importErr) throw importErr;

      // Insert cashflow entries in batches
      const batchSize = 50;
      let imported = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        const entries = batch.map((r) => ({
          user_id: user.id,
          organization_id: currentOrg.id,
          tipo,
          source: "importacao",
          descricao: r.mapped.descricao || "Sem descrição",
          valor_previsto: Math.abs(r.mapped.valor_previsto || 0),
          valor_bruto: Math.abs(r.mapped.valor_previsto || 0),
          valor_desconto: 0,
          valor_juros_multa: 0,
          data_prevista: r.mapped.data_prevista || new Date().toISOString().slice(0, 10),
          data_realizada: r.mapped.data_realizada || null,
          data_vencimento: r.mapped.data_prevista || null,
          status: r.mapped.data_realizada ? "pago" : "pendente",
          categoria: r.mapped.categoria || null,
          documento: r.mapped.documento || null,
          notes: r.mapped.notes || null,
          impacto_fluxo_caixa: true,
          impacto_orcamento: true,
          afeta_caixa_no_vencimento: true,
        }));

        const { error: batchErr } = await supabase.from("cashflow_entries").insert(entries);
        if (batchErr) throw batchErr;
        imported += batch.length;
      }

      // Update staging status
      await supabase
        .from("data_imports")
        .update({ status: "completed", imported_at: new Date().toISOString() })
        .eq("id", importRecord.id);

      setImportCount(imported);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] });
      toast({ title: "Importação concluída", description: `${imported} lançamentos importados com sucesso.` });
    } catch (e) {
      console.error("Import error:", e);
      setError("Erro na importação: " + (e instanceof Error ? e.message : "erro desconhecido"));
      setStep("preview");
    }
  }, [parsedRows, mappings, tipo, user, currentOrg, fileName, queryClient, toast]);

  const goToMapping = useCallback(() => {
    setStep("mapping");
  }, []);

  return {
    step,
    fileName,
    rawHeaders,
    rawRows,
    detectedFormat,
    mappings,
    parsedRows,
    importCount,
    error,
    reset,
    parseFile,
    updateMapping,
    buildPreview,
    goToMapping,
    executeImport,
  };
}
