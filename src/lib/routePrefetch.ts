/**
 * Route-level query prefetch.
 *
 * Each entry corresponds to a sidebar route. Calling `prefetchRoute(key, ctx)`
 * triggers React Query prefetches for the queries that are *guaranteed* to run
 * when that page mounts, so the user sees data immediately on click instead
 * of a skeleton.
 *
 * Keep this list conservative — only prefetch the 1-2 heaviest queries per
 * route (the ones that drive the initial paint). Anything else can lazy-load.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cachePresets } from "@/lib/cachePresets";

export interface PrefetchContext {
  qc: QueryClient;
  orgId: string | null | undefined;
  activeOrgIds: string[];
  holdingMode: boolean;
  userId: string | null | undefined;
}

type Prefetcher = (ctx: PrefetchContext) => void;

/** Resolve which org filter to use (single org vs holding mode). */
function applyOrgFilter<T extends { in: any; eq: any }>(q: T, ctx: PrefetchContext): T {
  if (ctx.holdingMode && ctx.activeOrgIds.length > 0) {
    return q.in("organization_id", ctx.activeOrgIds);
  }
  if (ctx.orgId) {
    return q.eq("organization_id", ctx.orgId);
  }
  return q;
}

const orgKey = (ctx: PrefetchContext) =>
  ctx.holdingMode ? ctx.activeOrgIds : ctx.orgId;

/** Prefetch helpers — all idempotent and cheap. */
const prefetchers: Partial<Record<string, Prefetcher>> = {
  dashboard: ({ qc, orgId, activeOrgIds, holdingMode }) => {
    if (!orgId) return;
    qc.prefetchQuery({
      queryKey: ["cashflow_entries", holdingMode ? activeOrgIds : orgId],
      queryFn: async () => {
        let q = supabase.from("cashflow_entries" as any).select("*").order("data_prevista");
        q = (holdingMode && activeOrgIds.length > 0
          ? q.in("organization_id", activeOrgIds)
          : q.eq("organization_id", orgId)) as any;
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      },
      ...cachePresets.operational,
    });
  },

  financeiro: (ctx) => prefetchers.dashboard?.(ctx),

  contratos: ({ qc, orgId, activeOrgIds, holdingMode }) => {
    if (!orgId) return;
    qc.prefetchQuery({
      queryKey: ["contracts", holdingMode ? activeOrgIds : orgId],
      queryFn: async () => {
        let q = supabase.from("contracts" as any).select("*").order("data_inicio", { ascending: false });
        q = (holdingMode && activeOrgIds.length > 0
          ? q.in("organization_id", activeOrgIds)
          : q.eq("organization_id", orgId)) as any;
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      },
      ...cachePresets.operational,
    });
  },

  dp: ({ qc, orgId, activeOrgIds, holdingMode }) => {
    if (!orgId) return;
    qc.prefetchQuery({
      queryKey: ["employees", holdingMode ? activeOrgIds : orgId],
      queryFn: async () => {
        let q = supabase.from("employees").select("*").order("name");
        q = (holdingMode && activeOrgIds.length > 0
          ? q.in("organization_id", activeOrgIds)
          : q.eq("organization_id", orgId)) as any;
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      },
      ...cachePresets.reference,
    });
  },

  crm: ({ qc, orgId }) => {
    if (!orgId) return;
    qc.prefetchQuery({
      queryKey: ["crm_deals", orgId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("crm_deals" as any)
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      },
      ...cachePresets.operational,
    });
  },

  cadastros: ({ qc, orgId }) => {
    if (!orgId) return;
    // Three reference tables — small, perfect for prefetch.
    qc.prefetchQuery({
      queryKey: ["chart_of_accounts", orgId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("chart_of_accounts" as any)
          .select("*")
          .eq("organization_id", orgId)
          .order("code");
        if (error) throw error;
        return data ?? [];
      },
      ...cachePresets.reference,
    });
    qc.prefetchQuery({
      queryKey: ["cost_centers", orgId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("cost_centers" as any)
          .select("*, profiles:responsible(full_name)")
          .eq("organization_id", orgId)
          .order("code");
        if (error) throw error;
        return (data as any[]).map((cc) => ({
          ...cc,
          responsible_name: cc.profiles?.full_name ?? null,
          profiles: undefined,
        }));
      },
      ...cachePresets.reference,
    });
  },

  tarefas: ({ qc, orgId }) => {
    if (!orgId) return;
    qc.prefetchQuery({
      queryKey: ["tasks", orgId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("tasks" as any)
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      },
      ...cachePresets.operational,
    });
  },
};

const prefetched = new Set<string>();

/** Idempotent: each (route × org) combo runs at most once per session window
 *  to avoid hammering the API on rapid hover. */
export function prefetchRouteQueries(routeKey: string, ctx: PrefetchContext) {
  if (!routeKey) return;
  const fingerprint = `${routeKey}::${ctx.holdingMode ? ctx.activeOrgIds.join(",") : ctx.orgId ?? ""}`;
  if (prefetched.has(fingerprint)) return;
  const fn = prefetchers[routeKey];
  if (!fn) return;
  prefetched.add(fingerprint);
  try {
    fn(ctx);
  } catch {
    prefetched.delete(fingerprint);
  }
}

/** Useful when the org changes — invalidate the prefetch dedup cache. */
export function clearPrefetchCache() {
  prefetched.clear();
}
