import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listJobItems, listDeadLetter, retryItem } from "../services/itemsService";

export function useEtlJobItems(jobId: string | undefined) {
  return useQuery({
    queryKey: ["etl", "items", jobId],
    queryFn: () => listJobItems(jobId!),
    enabled: !!jobId,
    refetchInterval: 3000,
  });
}

export function useEtlDeadLetter(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["etl", "dlq", organizationId],
    queryFn: () => listDeadLetter(organizationId!),
    enabled: !!organizationId,
  });
}

export function useEtlItemActions() {
  const qc = useQueryClient();
  return {
    retryItem: useMutation({
      mutationFn: retryItem,
      onSuccess: () => qc.invalidateQueries({ queryKey: ["etl"] }),
    }),
  };
}
