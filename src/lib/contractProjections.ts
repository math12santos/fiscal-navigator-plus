import { addMonths, format, isBefore, isAfter } from "date-fns";
import type { Contract } from "@/hooks/useContracts";
import type { CashFlowEntry } from "@/hooks/useCashFlow";
import { projectionKey } from "@/lib/projectionRegistry";

/**
 * Determine if a contract should generate recurring cashflow projections.
 * Only recurring services (subscriptions, outsourcing, etc.) produce repeated entries.
 * All other types (merchandise, assets, one-off services) are single-entry or installment-based.
 */
export function isRecurringCashflow(contract: Contract): boolean {
  if (contract.tipo_recorrencia === "unico") return false;

  const isServicos = contract.subtipo_operacao === "servicos";
  if (!isServicos) return false;

  const nonRecurringFinalidades = [
    "servicos_pontuais",
    "servicos_tecnicos",
    "servicos_contrato",
  ];
  if (contract.finalidade && nonRecurringFinalidades.includes(contract.finalidade)) {
    return false;
  }

  return true;
}

/**
 * Generate projected cashflow entries from a contract's recurrence.
 * These are virtual entries (not persisted) for display purposes.
 */
export function generateProjectionsFromContract(
  contract: Contract,
  rangeFrom: Date,
  rangeTo: Date
): Omit<CashFlowEntry, "user_id" | "organization_id">[] {
  const projections: Omit<CashFlowEntry, "user_id" | "organization_id">[] = [];

  if (contract.status !== "Ativo") return projections;
  if (!isRecurringCashflow(contract)) return projections;

  const contractStart = contract.data_inicio ? new Date(contract.data_inicio) : new Date(contract.created_at);
  const contractEnd = contract.data_fim ? new Date(contract.data_fim) : null;

  const recurrenceMonths: Record<string, number> = {
    mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
  };
  const interval = recurrenceMonths[contract.tipo_recorrencia] ?? 1;
  const dia = contract.dia_vencimento ?? 1;

  const tipo = contract.impacto_resultado === "receita" ? "entrada" : "saida";

  let cursor = new Date(contractStart.getFullYear(), contractStart.getMonth(), Math.min(dia, 28));

  while (!isAfter(cursor, rangeTo)) {
    if (!isBefore(cursor, rangeFrom) && !isAfter(cursor, rangeTo)) {
      if (!contractEnd || !isAfter(cursor, contractEnd)) {
        const dataPrevista = format(cursor, "yyyy-MM-dd");
        projections.push({
          id: `proj-${contract.id}-${format(cursor, "yyyy-MM")}`,
          contract_id: contract.id,
          contract_installment_id: null,
          tipo,
          categoria: contract.natureza_financeira,
          descricao: `${contract.nome} — ${format(cursor, "MM/yyyy")}`,
          valor_previsto: Number(contract.valor),
          valor_realizado: null,
          data_prevista: dataPrevista,
          data_realizada: null,
          status: "previsto",
          account_id: null,
          cost_center_id: contract.cost_center_id,
          entity_id: contract.entity_id,
          notes: null,
          source: "contrato",
          source_ref: projectionKey.contract(contract.id, dataPrevista),
          created_at: contract.created_at,
          updated_at: contract.created_at,
        } as any);
      }
    }
    cursor = addMonths(cursor, interval);
  }

  return projections;
}
