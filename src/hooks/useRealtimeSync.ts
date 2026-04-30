import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

type EventType = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriptionConfig {
  /** Postgres table name in the `public` schema. */
  table: string;
  /** React Query key prefixes to invalidate when an event arrives. */
  invalidateKeys: ReadonlyArray<readonly unknown[]>;
  /** Restrict which events trigger invalidation. Default `*`. */
  event?: EventType;
  /** Optional Postgres filter (e.g. "organization_id=eq.<uuid>"). Auto-built from currentOrg if omitted. */
  filter?: string;
  /** Set to false to disable org-scoped filter even when currentOrg is set. */
  scopeToOrg?: boolean;
}

/**
 * Realtime sync hook — subscribes to one or more tables and invalidates
 * matching React Query caches when changes are received from the server.
 *
 * Example:
 *   useRealtimeSync([
 *     { table: "cashflow_entries", invalidateKeys: [["cashflow"], ["cashflow-summary"], ["dashboard-kpis"]] },
 *     { table: "contracts",        invalidateKeys: [["contracts"], ["dashboard-kpis"]] },
 *   ]);
 *
 * Notes:
 * - Channels are unique per (table + filter) combination to avoid duplicates.
 * - All subscriptions are torn down on unmount.
 * - Throttling is intentionally NOT implemented here — React Query already
 *   coalesces back-to-back invalidations of the same key.
 */
export function useRealtimeSync(subs: ReadonlyArray<SubscriptionConfig>) {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? null;

  // Stable JSON key so React doesn't churn channels every render.
  const subsKey = useRef(JSON.stringify(subs.map((s) => ({
    t: s.table, e: s.event ?? "*", f: s.filter, s: s.scopeToOrg !== false,
  }))));

  useEffect(() => {
    const channels = subs.map((cfg) => {
      const event = cfg.event ?? "*";
      const filter =
        cfg.filter ??
        (cfg.scopeToOrg !== false && orgId ? `organization_id=eq.${orgId}` : undefined);

      const channelName = `rt:${cfg.table}:${filter ?? "all"}`;

      const channel = supabase
        .channel(channelName)
        .on(
          // @ts-expect-error supabase-js typing for postgres_changes is loose
          "postgres_changes",
          { event, schema: "public", table: cfg.table, filter },
          () => {
            for (const key of cfg.invalidateKeys) {
              queryClient.invalidateQueries({ queryKey: key });
            }
          },
        )
        .subscribe();

      return channel;
    });

    return () => {
      for (const ch of channels) supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, subsKey.current, queryClient]);
}
