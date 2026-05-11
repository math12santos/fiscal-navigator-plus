// PDF bank statement parser (best-effort heuristic).
// Uses pdfjs-dist on the client to extract text per line, then matches typical
// Brazilian statement patterns: "dd/mm/yyyy <descrição> <valor>[D|C|-]".
// Returns rows shaped to match the existing import pipeline.

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite handles the worker URL import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PdfStatementRow {
  data: string;
  descricao: string;
  valor: number;
  documento: string | null;
}

export interface PdfStatementParseResult {
  headers: string[];
  rows: string[][];
  rawLines: string[];
  pageCount: number;
}

const HEADER_FIELDS = ["data", "descricao", "valor", "documento"];

function brDateToIso(d: string): string | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!m) return null;
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yyyy}-${m[2]}-${m[1]}`;
}

function parseBrNumber(raw: string): number | null {
  // Examples: "1.234,56", "-1.234,56", "1234,56-", "1234,56 D"
  let s = raw.trim();
  if (!s) return null;
  let sign = 1;
  if (/[\-]$/.test(s)) {
    sign = -1;
    s = s.replace(/[\-]+$/, "").trim();
  }
  if (/[Dd]$/.test(s) && !/[Cc]$/.test(s)) {
    sign = -1;
    s = s.replace(/[Dd]+$/, "").trim();
  } else if (/[Cc]$/.test(s)) {
    s = s.replace(/[Cc]+$/, "").trim();
  }
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1).trim();
  }
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!isFinite(n)) return null;
  return n * sign;
}

// Regex: capture date at start, money at end (allowing trailing D/C/-)
const LINE_RE = /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+([\-]?\d{1,3}(?:\.\d{3})*,\d{2})\s*([DCdc\-]?)\s*$/;

export async function parsePdfStatement(
  file: File
): Promise<PdfStatementParseResult> {
  const buffer = await file.arrayBuffer();
  const loadingTask = (pdfjsLib as any).getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by Y coordinate (rounded) to reconstruct lines
    const byY: Map<number, { x: number; str: string }[]> = new Map();
    for (const item of content.items as any[]) {
      const str = (item.str ?? "").toString();
      if (!str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x, str });
    }

    const ys = Array.from(byY.keys()).sort((a, b) => b - a); // top to bottom
    for (const y of ys) {
      const parts = byY.get(y)!.sort((a, b) => a.x - b.x);
      const line = parts.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) allLines.push(line);
    }
  }

  const rows: string[][] = [];
  for (const line of allLines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const iso = brDateToIso(m[1]);
    if (!iso) continue;
    const amount = parseBrNumber(`${m[3]}${m[4] || ""}`);
    if (amount == null) continue;

    // Try to extract a doc number from the description (very heuristic)
    const desc = m[2].trim();
    const docMatch = desc.match(/\b(\d{6,})\b/);
    const documento = docMatch ? docMatch[1] : "";

    rows.push([iso, desc, amount.toFixed(2), documento]);
  }

  return {
    headers: HEADER_FIELDS,
    rows,
    rawLines: allLines,
    pageCount: pdf.numPages,
  };
}
