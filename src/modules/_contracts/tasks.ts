/**
 * Contrato interno: criação automática de tarefas a partir de eventos
 * de outros módulos (audiências jurídicas, garantias TI vencendo,
 * contratos a renovar, etc.).
 *
 * Implementação concreta em `src/modules/_integrations/autoTaskDispatcher.ts`.
 */

export type AutoTaskModule =
  | "juridico"
  | "ti"
  | "contratos"
  | "crm"
  | "dp"
  | "financeiro";

export type AutoTaskPriority = "low" | "normal" | "high" | "critical";

export interface AutoTaskRequest {
  organization_id: string;
  module: AutoTaskModule;
  source_table: string;
  source_id: string;
  title: string;
  description?: string | null;
  due_date: string; // yyyy-MM-dd
  priority?: AutoTaskPriority;
  assignee_user_id?: string | null;
  cost_center_id?: string | null;
}
