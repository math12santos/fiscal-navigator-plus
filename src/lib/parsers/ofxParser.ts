// OFX (1.x SGML and 2.x XML) statement parser.
// Returns rows shaped to match the existing import pipeline (date/desc/valor/documento).

export interface OfxRow {
  data: string; // ISO yyyy-mm-dd
  descricao: string;
  valor: number; // signed
  documento: string | null; // FITID
  notes: string | null;
}

export interface OfxParseResult {
  headers: string[];
  rows: string[][];
  bank?: { bankid?: string; acctid?: string; currency?: string } | null;
}

const FIELDS = ["data", "descricao", "valor", "documento", "notes"] as const;

function getTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function ofxDateToIso(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseOfx(text: string): OfxParseResult {
  // Strip header (everything before the first <OFX> tag) — OFX 1.x has SGML headers
  const ofxStart = text.search(/<OFX>/i);
  const body = ofxStart >= 0 ? text.slice(ofxStart) : text;

  // Bank info (best effort)
  const bankBlock = body.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i)?.[1] ?? "";
  const bank = {
    bankid: getTag(bankBlock, "BANKID") ?? undefined,
    acctid: getTag(bankBlock, "ACCTID") ?? undefined,
    currency: getTag(body, "CURDEF") ?? undefined,
  };

  // Find every <STMTTRN>...</STMTTRN> (works for both SGML and XML variants once block boundaries are matched)
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  const rows: string[][] = [];
  let match: RegExpExecArray | null;

  while ((match = re.exec(body)) !== null) {
    const block = match[1];
    const dateRaw = getTag(block, "DTPOSTED");
    const amountRaw = getTag(block, "TRNAMT");
    const memo = getTag(block, "MEMO");
    const name = getTag(block, "NAME");
    const fitid = getTag(block, "FITID");
    const checknum = getTag(block, "CHECKNUM");

    const iso = ofxDateToIso(dateRaw);
    if (!iso || !amountRaw) continue;

    const valor = Number(String(amountRaw).replace(",", ".")) || 0;
    const descricao = [name, memo].filter(Boolean).join(" — ").trim() || "(sem descrição)";

    rows.push([
      iso,
      descricao,
      String(valor.toFixed(2)),
      (fitid || checknum || "").trim(),
      memo && name ? memo : "",
    ]);
  }

  return {
    headers: ["data", "descricao", "valor", "documento", "notes"],
    rows,
    bank,
  };
}

export const OFX_TARGET_HEADERS = FIELDS;
