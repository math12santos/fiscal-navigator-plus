import { format, parseISO, startOfMonth, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Extracts the effective competency (reference month) from a cashflow entry,
 * falling back across the documented fields used by the projection engine.
 * Returns `null` when nothing usable is found.
 */
export function getEntryCompetency(entry: {
  competencia?: string | null;
  reference_month?: string | null;
  data_prevista?: string | null;
}): Date | null {
  const raw = entry.competencia ?? entry.reference_month ?? null;
  if (raw) {
    try {
      // Accept "yyyy-MM-dd" or "yyyy-MM"
      const safe = raw.length === 7 ? `${raw}-01` : raw;
      return startOfMonth(parseISO(safe));
    } catch {
      /* fall through */
    }
  }
  if (entry.data_prevista) {
    try {
      return startOfMonth(parseISO(entry.data_prevista));
    } catch {
      return null;
    }
  }
  return null;
}

export function formatCompetencyShort(d: Date | null): string {
  if (!d) return "—";
  return format(d, "MM/yyyy");
}

export function formatCompetencyLong(d: Date | null): string {
  if (!d) return "—";
  return format(d, "MMMM 'de' yyyy", { locale: ptBR });
}

export type CompetencyShift = "aligned" | "anticipated" | "delayed";

/**
 * Compares the entry competency with the disbursement month (`data_prevista`).
 * - `anticipated`: paid before the competency month (typical for VR/VA credit).
 * - `delayed`: paid after the competency month (e.g., INSS due on day 20 of N+1).
 * - `aligned`: same month.
 */
export function getCompetencyShift(entry: {
  competencia?: string | null;
  reference_month?: string | null;
  data_prevista: string;
}): CompetencyShift {
  const comp = getEntryCompetency(entry);
  if (!comp) return "aligned";
  let pay: Date;
  try {
    pay = startOfMonth(parseISO(entry.data_prevista));
  } catch {
    return "aligned";
  }
  if (isSameMonth(comp, pay)) return "aligned";
  return comp > pay ? "anticipated" : "delayed";
}

/**
 * Returns a human-readable explanation for the shift, used in tooltips.
 */
export function describeCompetencyShift(
  shift: CompetencyShift,
  comp: Date | null,
  pay: Date | null,
): string | null {
  if (shift === "aligned" || !comp || !pay) return null;
  const compLabel = formatCompetencyLong(comp);
  const payLabel = formatCompetencyLong(pay);
  if (shift === "anticipated") {
    return `Pagamento antecipado: refere-se à competência de ${compLabel}, mas é desembolsado em ${payLabel} (regra CLT/PAT — VR/VA são creditados no mês anterior ao uso). Veja a configuração em Departamento Pessoal → Configuração.`;
  }
  return `Pagamento postergado: refere-se à competência de ${compLabel}, com vencimento em ${payLabel} (típico de tributos como INSS/IRRF/FGTS).`;
}
