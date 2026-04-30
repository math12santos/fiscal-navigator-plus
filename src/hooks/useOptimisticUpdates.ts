import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Helpers for optimistic mutations with React Query.
 *
 * Pattern:
 *   const opt = useOptimisticUpdates();
 *
 *   useMutation({
 *     mutationFn: api.updateEntry,
 *     onMutate: (next) => opt.optimisticUpdate<Entry>(["cashflow", orgId], (rows) =>
 *       rows.map((r) => (r.id === next.id ? { ...r, ...next } : r))
 *     ),
 *     onError: (_e, _v, ctx) => opt.rollback(ctx),
 *     onSettled: () => queryClient.invalidateQueries({ queryKey: ["cashflow", orgId] }),
 *   });
 *
 * Returns a `context` object with the previous snapshot so onError can roll back.
 */
export function useOptimisticUpdates() {
  const queryClient = useQueryClient();

  const optimisticUpdate = useCallback(
    async <T,>(
      queryKey: QueryKey,
      updater: (current: T[] | undefined) => T[] | undefined,
    ) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic value.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T[]>(queryKey);
      queryClient.setQueryData<T[] | undefined>(queryKey, (old) => updater(old));
      return { queryKey, previous };
    },
    [queryClient],
  );

  const rollback = useCallback(
    (context: { queryKey: QueryKey; previous: unknown } | undefined) => {
      if (!context) return;
      queryClient.setQueryData(context.queryKey, context.previous);
    },
    [queryClient],
  );

  const optimisticInsert = useCallback(
    async <T,>(queryKey: QueryKey, item: T) =>
      optimisticUpdate<T>(queryKey, (current) => [item, ...(current ?? [])]),
    [optimisticUpdate],
  );

  const optimisticDelete = useCallback(
    async <T extends { id: string }>(queryKey: QueryKey, id: string) =>
      optimisticUpdate<T>(queryKey, (current) => (current ?? []).filter((r) => r.id !== id)),
    [optimisticUpdate],
  );

  return { optimisticUpdate, optimisticInsert, optimisticDelete, rollback };
}
