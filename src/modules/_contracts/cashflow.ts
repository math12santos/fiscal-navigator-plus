/**
 * Contrato interno: lançamentos no fluxo de caixa.
 *
 * Qualquer módulo que precise materializar um fato financeiro no caixa
 * (DP, Contratos, CRM, Jurídico, TI, ...) deve produzir um `CashflowEntryInput`
 * conforme este contrato e entregá-lo a um orquestrador em `_integrations/`.
 *
 * NÃO importe esse arquivo a partir de services/hooks de outros módulos.
 */

export type CashflowDirection = "entrada" | "saida";

export type CashflowSource =
  | "contrato"
  | "contrato_parcela"
  | "dp"
  | "dp_rescisao"
  | "crm_won"
  | "hr_planning"
  | "juridico_acordo"
  | "juridico_despesa"
  | "ti_compra"
  | "ti_incidente"
  | "manual"
  | "import";

export interface CashflowEntryInput {
  organization_id: string;
  cost_center_id?: string | null;
  direction: CashflowDirection;
  amount: number;
  data_prevista: string; // yyyy-MM-dd
  data_efetiva?: string | null;
  description: string;
  source: CashflowSource;
  /** Chave canônica MECE — ver `_contracts/projections.ts`. */
  source_ref: string;
  notes?: string | null;
  contract_id?: string | null;
  contract_installment_id?: string | null;
}
