/**
 * Jurídico — API pública do módulo.
 * Outros módulos NÃO devem importar `services/` ou `domain/` diretamente:
 * usem este index ou um orquestrador em `_integrations/`.
 */

export { useJuridicoProcesses } from "./hooks/useJuridicoProcesses";
export { useJuridicoSettlements } from "./hooks/useJuridicoSettlements";
export { useJuridicoExpenses } from "./hooks/useJuridicoExpenses";
export { useJuridicoConfig } from "./hooks/useJuridicoConfig";

export { computeRiskExposure } from "./domain/riskMatrix";
export type {
  JuridicoProcess,
  JuridicoSettlement,
  JuridicoExpense,
  ProcessStatus,
  ProcessProbability,
} from "./domain/types";
export type { RiskExposure } from "./domain/riskMatrix";
