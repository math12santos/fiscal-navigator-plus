import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export type ImportStep = "upload" | "detecting" | "mapping" | "preview" | "entity_matching" | "importing" | "done";

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

export function normalizeEntityName(s: string): string {
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function entitySimilarity(a: string, b: string): number {
  const na = normalizeEntityName(a);
  const nb = normalizeEntityName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(" ").filter((t) => t.length > 1));
  const tb = new Set(nb.split(" ").filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / Math.max(ta.size, tb.size);
}

export type EntityMatchStatus = "found" | "possible" | "new" | "ignored";

export interface EntityMatch {
  importedName: string;
  status: EntityMatchStatus;
  matchedEntityId: string | null;
  suggestedEntityId: string | null;
  confidence: number;
  occurrences: number;
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
  const [skippedCount, setSkippedCount] = useState(0);
  const [failedRows, setFailedRows] = useState<{ rowIndex: number; raw: Record<string, string>; error: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [entityMatches, setEntityMatches] = useState<EntityMatch[]>([]);

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
    setExcludedRows(new Set());
    setEntityMatches([]);
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

      const sampleRows = rows.slice(0, 5);
      const { data, error: fnError } = await supabase.functions.invoke("detect-import-mapping", {
        body: { headers, sampleRows },
      });

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
        if (import.meta.env.DEV) console.error("AI mapping error:", fnError || data?.error);
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
      if (import.meta.env.DEV) console.error("Parse error:", e);
      setError("Erro ao processar arquivo: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }, [toast]);

  const updateMapping = useCallback((sourceColumn: string, newTarget: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.source_column === sourceColumn ? { ...m, target_field: newTarget, confidence: "high" } : m))
    );
  }, []);

  const updateMappingByTarget = useCallback((targetField: string, sourceColumn: string) => {
    setMappings((prev) => {
      let updated = sourceColumn
        ? prev.map((m) => (m.source_column === sourceColumn && m.target_field !== targetField ? { ...m, source_column: null, confidence: null } : m))
        : prev;
      return updated.map((m) =>
        m.target_field === targetField
          ? { ...m, source_column: sourceColumn || null, confidence: sourceColumn ? "high" as const : null }
          : m
      );
    });
  }, []);

  const buildPreview = useCallback(() => {
    const parseNum = detectedFormat?.number_format === "us" ? parseUSNumber : parseBRNumber;
    const parseDate = detectedFormat?.date_format?.startsWith("MM") ? parseUSDate : parseBRDate;

    const fieldByHeader: Record<string, string> = {};
    mappings.forEach((m) => {
      if (m.source_column && m.target_field !== "ignorar") fieldByHeader[m.source_column] = m.target_field;
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

      if (!mapped.descricao) errors.push("Descrição ausente");
      if (!mapped.valor_previsto && mapped.valor_previsto !== 0) errors.push("Valor ausente");
      if (!mapped.data_prevista) errors.push("Data ausente");

      return { raw: rawObj, mapped, errors };
    });

    setParsedRows(parsed);
    setStep("preview");
  }, [rawHeaders, rawRows, mappings, detectedFormat]);

  /** Build entity matches from current valid rows; loads existing entities and classifies */
  const prepareEntityMatching = useCallback(async (): Promise<boolean> => {
    if (!currentOrg?.id) return false;

    // Collect unique entity names from valid (not excluded, no errors) rows
    const counts = new Map<string, number>();
    parsedRows.forEach((r, i) => {
      if (r.errors.length > 0 || excludedRows.has(i)) return;
      const name = (r.mapped.entity_name || "").toString().trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });

    if (counts.size === 0) {
      // Skip directly to import if no entity names
      return false;
    }

    // Filter by tipo: saida → fornecedor/ambos; entrada → cliente/ambos
    const allowedTypes = tipo === "saida" ? ["fornecedor", "ambos"] : ["cliente", "ambos"];

    const { data, error: e } = await supabase
      .from("entities")
      .select("id, name, type, document_number")
      .eq("organization_id", currentOrg.id)
      .eq("active", true);

    if (e) {
      if (import.meta.env.DEV) console.error("Load entities error:", e);
      toast({ title: "Erro ao carregar cadastros", description: e.message, variant: "destructive" });
      return false;
    }

    const entities = (data || []) as { id: string; name: string; type: string; document_number: string | null }[];
    const candidates = entities.filter((ent) => allowedTypes.includes(ent.type));

    const matches: EntityMatch[] = Array.from(counts.entries()).map(([importedName, occ]) => {
      let best: { id: string; score: number } | null = null;
      for (const ent of candidates) {
        const s = entitySimilarity(importedName, ent.name);
        if (!best || s > best.score) best = { id: ent.id, score: s };
      }
      const score = best?.score ?? 0;
      let status: EntityMatchStatus;
      let matchedEntityId: string | null = null;
      let suggestedEntityId: string | null = null;
      if (score >= 0.9) {
        status = "found";
        matchedEntityId = best!.id;
      } else if (score >= 0.6) {
        status = "possible";
        suggestedEntityId = best!.id;
      } else {
        status = "new";
      }
      return {
        importedName,
        status,
        matchedEntityId,
        suggestedEntityId,
        confidence: score,
        occurrences: occ,
      };
    });

    matches.sort((a, b) => {
      const order = { possible: 0, new: 1, found: 2, ignored: 3 } as const;
      return order[a.status] - order[b.status] || b.occurrences - a.occurrences;
    });

    setEntityMatches(matches);
    setStep("entity_matching");
    return true;
  }, [parsedRows, excludedRows, currentOrg, tipo, toast]);

  const updateEntityMatch = useCallback((importedName: string, patch: Partial<EntityMatch>) => {
    setEntityMatches((prev) => prev.map((m) => (m.importedName === importedName ? { ...m, ...patch } : m)));
  }, []);

  /** Create entities in bulk for all rows currently flagged "new" */
  const createMissingEntities = useCallback(async (): Promise<number> => {
    if (!user?.id || !currentOrg?.id) return 0;
    const toCreate = entityMatches.filter((m) => m.status === "new");
    if (toCreate.length === 0) return 0;

    const entityType = tipo === "saida" ? "fornecedor" : "cliente";

    const payload = toCreate.map((m) => ({
      name: m.importedName,
      type: entityType,
      active: true,
      user_id: user.id,
      organization_id: currentOrg.id,
    }));

    const { data, error: e } = await supabase
      .from("entities")
      .insert(payload as any)
      .select("id, name");

    if (e) {
      toast({ title: "Erro ao criar cadastros", description: e.message, variant: "destructive" });
      return 0;
    }

    const created = (data || []) as { id: string; name: string }[];
    setEntityMatches((prev) =>
      prev.map((m) => {
        const found = created.find((c) => c.name === m.importedName);
        if (found) return { ...m, status: "found", matchedEntityId: found.id, confidence: 1 };
        return m;
      })
    );
    queryClient.invalidateQueries({ queryKey: ["entities", currentOrg.id] });
    toast({ title: `${created.length} cadastros criados`, description: "Vinculados aos lançamentos importados." });
    return created.length;
  }, [entityMatches, tipo, user, currentOrg, queryClient, toast]);

  /** Confirm a possible match → upgrades to found */
  const confirmPossibleMatch = useCallback((importedName: string) => {
    setEntityMatches((prev) =>
      prev.map((m) =>
        m.importedName === importedName && m.suggestedEntityId
          ? { ...m, status: "found", matchedEntityId: m.suggestedEntityId, confidence: 1 }
          : m
      )
    );
  }, []);

  /** Manually pick an entity for any row */
  const selectEntityForMatch = useCallback((importedName: string, entityId: string | null) => {
    setEntityMatches((prev) =>
      prev.map((m) => {
        if (m.importedName !== importedName) return m;
        if (!entityId) return { ...m, matchedEntityId: null, status: m.status === "found" ? "new" : m.status };
        return { ...m, matchedEntityId: entityId, status: "found", confidence: 1 };
      })
    );
  }, []);

  const ignoreEntityMatch = useCallback((importedName: string) => {
    setEntityMatches((prev) =>
      prev.map((m) => (m.importedName === importedName ? { ...m, status: "ignored", matchedEntityId: null } : m))
    );
  }, []);

  const executeImport = useCallback(async () => {
    if (!user?.id || !currentOrg?.id) return;
    setStep("importing");
    setError(null);

    try {
      const validRows = parsedRows
        .map((r, i) => ({ row: r, idx: i }))
        .filter(({ row, idx }) => row.errors.length === 0 && !excludedRows.has(idx));
      if (validRows.length === 0) {
        setError("Nenhuma linha válida para importar.");
        setStep("preview");
        return;
      }

      const fieldByHeader: Record<string, string> = {};
      mappings.forEach((m) => {
        if (m.source_column && m.target_field !== "ignorar") fieldByHeader[m.source_column] = m.target_field;
      });

      // Build entityName → entityId map from current matches
      const nameToEntityId = new Map<string, string | null>();
      entityMatches.forEach((m) => nameToEntityId.set(m.importedName, m.matchedEntityId));

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

      const batchSize = 50;
      let imported = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        const entries = batch.map(({ row: r }) => {
          const importedName = (r.mapped.entity_name || "").toString().trim();
          const entityId = importedName ? nameToEntityId.get(importedName) ?? null : null;
          return {
            user_id: user.id,
            organization_id: currentOrg.id,
            import_id: importRecord.id,
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
            entity_id: entityId,
            impacto_fluxo_caixa: true,
            impacto_orcamento: true,
            afeta_caixa_no_vencimento: true,
          };
        });

        const { error: batchErr } = await supabase.from("cashflow_entries").insert(entries);
        if (batchErr) throw batchErr;
        imported += batch.length;
      }

      await supabase
        .from("data_imports")
        .update({ status: "completed", imported_at: new Date().toISOString() })
        .eq("id", importRecord.id);

      setImportCount(imported);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] });
      toast({ title: "Importação concluída", description: `${imported} lançamentos importados com sucesso.` });
    } catch (e) {
      if (import.meta.env.DEV) console.error("Import error:", e);
      setError("Erro na importação: " + (e instanceof Error ? e.message : "erro desconhecido"));
      setStep("preview");
    }
  }, [parsedRows, mappings, tipo, user, currentOrg, fileName, queryClient, toast, excludedRows, entityMatches]);

  const toggleRowExclusion = useCallback((index: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const goToMapping = useCallback(() => {
    setStep("mapping");
  }, []);

  const goToPreview = useCallback(() => {
    setStep("preview");
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
    excludedRows,
    entityMatches,
    reset,
    parseFile,
    updateMapping,
    updateMappingByTarget,
    buildPreview,
    goToMapping,
    goToPreview,
    prepareEntityMatching,
    updateEntityMatch,
    confirmPossibleMatch,
    selectEntityForMatch,
    ignoreEntityMatch,
    createMissingEntities,
    executeImport,
    toggleRowExclusion,
  };
}
