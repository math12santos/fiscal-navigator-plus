import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AuditLogEntry {
  entity_type: "chart_of_accounts" | "cost_centers";
  entity_id: string;
  action: "INSERT" | "UPDATE" | "DELETE" | "ACTIVATE" | "DEACTIVATE";
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
}

export function useAuditLog() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const log = useMutation({
    mutationFn: async (entry: AuditLogEntry) => {
      if (!user) return;
      const { error } = await supabase.from("audit_log" as any).insert({
        user_id: user.id,
        ...entry,
      });
      if (error && import.meta.env.DEV) {
        console.error("Audit log error:", error);
      }
    },
  });

  return { log: log.mutate };
}
