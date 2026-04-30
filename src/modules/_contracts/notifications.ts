/**
 * Contrato interno: notificações disparadas por integrações cross-módulo.
 */

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface NotificationPayload {
  organization_id: string;
  user_id?: string | null; // null = broadcast para org
  level: NotificationLevel;
  title: string;
  body?: string | null;
  link?: string | null;
  source_module?: string | null;
  source_ref?: string | null;
}
