/**
 * Cache presets for React Query.
 *
 * Use by spreading into useQuery options:
 *   useQuery({ ...cachePresets.reference, queryKey, queryFn })
 *
 * Categories:
 *  - reference: rarely changes (chart of accounts, cost centers, positions, products)
 *  - operational: changes during the workday (cashflow, contracts, tasks, requests)
 *  - realtime: must be near-fresh (notifications, etl jobs, slack inbox)
 *  - static: org/system config that almost never changes during a session
 *
 * Lower bound is set so we don't hammer Supabase under multi-user load,
 * upper bound (gcTime) keeps memory usable across long sessions.
 */
export const cachePresets = {
  reference: {
    staleTime: 15 * 60_000, // 15 min
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  operational: {
    staleTime: 2 * 60_000, // 2 min
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  realtime: {
    staleTime: 10_000, // 10 s
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  static: {
    staleTime: 60 * 60_000, // 1 h
    gcTime: 4 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
} as const;

export type CachePresetKey = keyof typeof cachePresets;
