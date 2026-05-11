// OFX (1.x SGML and 2.x XML) statement parser.
// Robust: tolerates BR/US number formats, partial dates, missing fields.
// Always returns the raw line — validation lives downstream (staging).

export interface OfxParseResult {
  headers: string[];
  rows: string[][];
  bank?: { bankid?: string; acctid?: string; currency?: string } | null;
}

const FIELDS = ["data", "descricao", "valor", "documento", "notes"] as const;

function getTag(block: string, tag: string): string | null {
  // Captures content up to next "<" OR end-tag OR newline; tolerates whitespace.
  const re = new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function ofxDateToIso(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, "");
  // yyyymmdd, yyyymmddHHMMSS, yyyymmddHHMMSS.xxx[TZ]
  let m = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // yyyy-mm-dd
  m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy
  m = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseOfxAmount(raw: string | null): number | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  // Negative via parentheses
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  if (s.startsWith("+")) { s = s.slice(1); }
  // Remove currency / spaces
  s = s.replace(/[R$\s]/gi, "");
  // BR format: "1.234,56" -> "1234.56" ; US format: "1,234.56" -> "1234.56"
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Only comma → assume decimal comma if 1 or 2 digits after it
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return neg ? -Math.abs(n) : n;
}

export function parseOfx(text: string): OfxParseResult {
  const ofxStart = text.search(/<OFX>/i);
  const body = ofxStart >= 0 ? text.slice(ofxStart) : text;

  const bankBlock = body.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i)?.[1] ?? "";
  const bank = {
    bankid: getTag(bankBlock, "BANKID") ?? undefined,
    acctid: getTag(bankBlock, "ACCTID") ?? undefined,
    currency: getTag(body, "CURDEF") ?? undefined,
  };

  // Find every <STMTTRN>...</STMTTRN>. Some banks omit the closing tag → fallback split.
  let blocks: string[] = [];
  const closedRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;
  while ((m = closedRe.exec(body)) !== null) blocks.push(m[1]);

  if (blocks.length === 0) {
    // Fallback: split on opening tag inside BANKTRANLIST
    const list = body.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i)?.[1] ?? body;
    blocks = list.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/?BANKTRANLIST>/i)[0]);
  }

  const rows: string[][] = [];
  for (const block of blocks) {
    const dateRaw = getTag(block, "DTPOSTED") ?? getTag(block, "DTUSER") ?? getTag(block, "DTAVAIL");
    const amountRaw = getTag(block, "TRNAMT");
    const memo = getTag(block, "MEMO");
    const name = getTag(block, "NAME") ?? getTag(block, "PAYEE");
    const fitid = getTag(block, "FITID");
    const checknum = getTag(block, "CHECKNUM");
    const refnum = getTag(block, "REFNUM");

    const iso = ofxDateToIso(dateRaw) ?? "";
    const valor = parseOfxAmount(amountRaw);
    const descricao = [name, memo].filter(Boolean).join(" — ").trim() || (memo ?? name ?? "(sem descrição)");
    const documento = (fitid || checknum || refnum || "").trim();

    // Always emit the row — validation downstream decides what to do.
    rows.push([
      iso,
      descricao,
      valor != null ? String(valor.toFixed(2)) : "",
      documento,
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
