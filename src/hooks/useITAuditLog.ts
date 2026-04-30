import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ITAuditLogRow {
  id: string;
  organization_id: string;
  table_name: string;
  record_id: string;
  action: "insert" | "update" | "delete" | "status_change";
  changed_by: string | null;
  before_data: any;
  after_data: any;
  changed_fields: string[] | null;
  created_at: string;
}

export interface AuditFilters {
  orgId?: string;
  table?: string | null;
  action?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}

export function useITAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: ["it-audit-log", filters],
    enabled: !!filters.orgId,
    queryFn: async (): Promise<ITAuditLogRow[]> => {
      let q = supabase
        .from("it_audit_log")
        .select("*")
        .eq("organization_id", filters.orgId!)
        .order("created_at", { ascending: false })
        .limit(filters.limit ?? 100);
      if (filters.table) q = q.eq("table_name", filters.table);
      if (filters.action) q = q.eq("action", filters.action as any);
      if (filters.from) q = q.gte("created_at", filters.from);
      if (filters.to) q = q.lte("created_at", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ITAuditLogRow[];
    },
  });
}
