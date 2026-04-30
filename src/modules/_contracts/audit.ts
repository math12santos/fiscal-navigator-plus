/**
 * Contrato interno: eventos de auditoria gravados por orquestradores
 * cross-módulo. Cada integração que produz efeito financeiro deve emitir
 * pelo menos um `AuditEvent`.
 */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "post_to_cashflow"
  | "materialize"
  | "auto_task";

export interface AuditEvent {
  organization_id: string;
  actor_user_id?: string | null;
  module: string;
  action: AuditAction;
  source_table: string;
  source_id: string;
  details?: Record<string, unknown> | null;
}
