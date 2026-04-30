export type ProcessStatus = "ativo" | "encerrado" | "arquivado" | "suspenso";
export type ProcessProbability = "remota" | "possivel" | "provavel";

export interface JuridicoProcess {
  id: string;
  organization_id: string;
  numero_processo?: string | null;
  parte_contraria?: string | null;
  tipo?: string | null;
  status: ProcessStatus;
  probabilidade: ProcessProbability;
  valor_causa?: number | null;
  valor_provisao?: number | null;
  data_distribuicao?: string | null;
  cost_center_id?: string | null;
  created_at: string;
}

export interface JuridicoSettlement {
  id: string;
  organization_id: string;
  process_id?: string | null;
  valor_total: number;
  data_acordo: string;
  status: "pendente" | "aprovado" | "cancelado";
}

export interface JuridicoExpense {
  id: string;
  organization_id: string;
  process_id?: string | null;
  descricao: string;
  valor: number;
  data_despesa: string;
  posted_to_cashflow_at?: string | null;
}
