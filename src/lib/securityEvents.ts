import { supabase } from "@/integrations/supabase/client";

export type SecurityEventType =
  | "password_reset_requested"
  | "password_reset_link_invalid"
  | "password_reset_link_expired"
  | "password_changed"
  | "password_change_reauth_failed"
  | "session_revoked_global"
  | "login_success"
  | "login_failed"
  | "rate_limit_blocked";

interface LogParams {
  type: SecurityEventType;
  userId?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget logger for security events.
 * Never throws — auditing must never break the user flow.
 */
export async function logSecurityEvent({ type, userId, email, metadata }: LogParams) {
  try {
    await supabase.from("security_events" as any).insert({
      event_type: type,
      user_id: userId ?? null,
      email: email ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      metadata: metadata ?? {},
    });
  } catch {
    // swallow
  }
}
