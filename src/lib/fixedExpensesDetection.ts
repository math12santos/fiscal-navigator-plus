import { addMonths, format, isAfter, isBefore, parseISO, startOfMonth } from "date-fns";
import type { CashFlowEntry } from "@/hooks/useCashFlow";
import type { Contract } from "@/hooks/useContracts";
import { isRecurringCashflow } from "@/lib/contractProjections";

export type FixedExpenseSuggestion = {
  /** Stable key used for ignore persistence and React lists. */
  key: string;
  /** Origin used to render badge / context. */
  origin: "contrato" | "padrao";
  tipo: "entrada" | "saida";
  descricao: string;
  /** Average value (BRL) across detected occurrences. */
  valorMedio: number;
  /** Suggested day-of-month (1-28) inferred from history or contract start. */
  diaSugerido: number;
  /** Free-text explanation. */
  motivo: string;
  /** Pre-built payload for cashflow_entry insertion. */
  payload: {
    tipo: "entrada" | "saida";
    descricao: string;
    valor_previsto: number;
    valor_realizado: number | null;
    data_prevista: string;
    data_realizada: string | null;
    status: "previsto";
    account_id: string | null;
    cost_center_id: string | null;
    entity_id: string | null;
    contract_id: string | null;
    contract_installment_id: string | null;
    categoria: string | null;
    notes: string;
    source: "sugestao_fixa";
  };
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/**
 * Build budget suggestions for `targetMonth` based on:
 *  - active recurring contracts that have no projection inside the period
 *  - cashflow entries that recurred in >=2 of the last 3 calendar months
 */
export function buildFixedExpenseSuggestions(args: {
  contracts: Contract[];
  historyEntries: CashFlowEntry[];
  /** Entries already covering the target period (materialized OR virtual). */
  periodEntries: CashFlowEntry[];
  /** First day of the month being projected. */
  targetMonth: Date;
}): FixedExpenseSuggestion[] {
  const { contracts, historyEntries, periodEntries, targetMonth } = args;
  const suggestions: FixedExpenseSuggestion[] = [];
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = addMonths(monthStart, 1);

  // ---- 1) Recurring contracts without projection in the target month ------
  const contractIdsCoveredInPeriod = new Set(
    periodEntries.map((e) => e.contract_id).filter(Boolean) as string[],
  );

  for (const c of contracts) {
    if (c.status !== "Ativo" || !isRecurringCashflow(c)) continue;
    if (contractIdsCoveredInPeriod.has(c.id)) continue;

    const startStr = c.data_inicio ?? format(new Date(c.created_at), "yyyy-MM-dd");
    const startDate = parseISO(startStr);
    if (isAfter(startDate, monthEnd)) continue;
    if (c.data_fim && isBefore(parseISO(c.data_fim), monthStart)) continue;

    const day = Math.min(28, startDate.getDate() || 1);
    const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const tipo: "entrada" | "saida" = c.impacto_resultado === "receita" ? "entrada" : "saida";
    const valor = Number(c.valor) || 0;
    if (valor <= 0) continue;

    suggestions.push({
      key: `contrato:${c.id}:${format(monthStart, "yyyy-MM")}`,
      origin: "contrato",
      tipo,
      descricao: c.nome,
      valorMedio: valor,
      diaSugerido: day,
      motivo: "Contrato recorrente ativo sem projeção neste período",
      payload: {
        tipo,
        descricao: `${c.nome} (orçamento)`,
        valor_previsto: valor,
        valor_realizado: null,
        data_prevista: format(dueDate, "yyyy-MM-dd"),
        data_realizada: null,
        status: "previsto",
        account_id: null,
        cost_center_id: c.cost_center_id ?? null,
        entity_id: c.entity_id ?? null,
        contract_id: c.id,
        contract_installment_id: null,
        categoria: c.natureza_financeira ?? null,
        notes: `Sugestão automática a partir do contrato ${c.nome}`,
        source: "sugestao_fixa",
      },
    });
  }

  // ---- 2) Repetition pattern: same description in >=2 of the last 3 months -
  // Build month buckets for last 3 calendar months relative to targetMonth.
  const buckets: Record<string, CashFlowEntry[]> = {};
  for (let i = 1; i <= 3; i++) {
    const mStart = addMonths(monthStart, -i);
    const k = format(mStart, "yyyy-MM");
    buckets[k] = [];
  }
  for (const e of historyEntries) {
    const k = (e.data_realizada ?? e.data_prevista).slice(0, 7);
    if (k in buckets) buckets[k].push(e);
  }

  // Group within each month, then aggregate group keys across months.
  type Agg = { occurrences: number; sumValor: number; sample: CashFlowEntry; days: number[] };
  const groups: Record<string, Agg> = {};
  for (const monthEntries of Object.values(buckets)) {
    const seenKeysThisMonth = new Set<string>();
    for (const e of monthEntries) {
      if ((e as any).dp_sub_category === "provisao_acumulada") continue;
      if ((e.categoria ?? "") === "transferencia_interna") continue;
      if (e.is_estorno) continue;
      const key = [
        e.tipo,
        normalize(e.descricao).slice(0, 40),
        e.account_id ?? "",
        e.entity_id ?? "",
      ].join("|");
      if (seenKeysThisMonth.has(key)) continue;
      seenKeysThisMonth.add(key);
      const valor = Number(e.valor_realizado ?? e.valor_previsto) || 0;
      const day = parseISO(e.data_prevista).getDate();
      if (!groups[key]) {
        groups[key] = { occurrences: 0, sumValor: 0, sample: e, days: [] };
      }
      groups[key].occurrences += 1;
      groups[key].sumValor += valor;
      groups[key].days.push(day);
    }
  }

  const periodKeys = new Set(
    periodEntries.map((e) =>
      [e.tipo, normalize(e.descricao).slice(0, 40), e.account_id ?? "", e.entity_id ?? ""].join("|"),
    ),
  );

  for (const [key, agg] of Object.entries(groups)) {
    if (agg.occurrences < 2) continue;
    if (periodKeys.has(key)) continue;
    if (agg.sumValor <= 0) continue;
    const valorMedio = agg.sumValor / agg.occurrences;
    const day = Math.min(28, Math.round(agg.days.reduce((s, d) => s + d, 0) / agg.days.length) || 1);
    const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);

    suggestions.push({
      key: `padrao:${key}:${format(monthStart, "yyyy-MM")}`,
      origin: "padrao",
      tipo: agg.sample.tipo as "entrada" | "saida",
      descricao: agg.sample.descricao,
      valorMedio,
      diaSugerido: day,
      motivo: `Repetiu em ${agg.occurrences} dos últimos 3 meses`,
      payload: {
        tipo: agg.sample.tipo as "entrada" | "saida",
        descricao: `${agg.sample.descricao} (orçamento)`,
        valor_previsto: Math.round(valorMedio),
        valor_realizado: null,
        data_prevista: format(dueDate, "yyyy-MM-dd"),
        data_realizada: null,
        status: "previsto",
        account_id: agg.sample.account_id ?? null,
        cost_center_id: agg.sample.cost_center_id ?? null,
        entity_id: agg.sample.entity_id ?? null,
        contract_id: null,
        contract_installment_id: null,
        categoria: agg.sample.categoria ?? null,
        notes: "Sugestão automática a partir de padrão de recorrência",
        source: "sugestao_fixa",
      },
    });
  }

  return suggestions.sort((a, b) => b.valorMedio - a.valorMedio);
}
