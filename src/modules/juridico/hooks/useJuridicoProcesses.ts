import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { toast } from "sonner";
import {
  listProcesses,
  upsertProcess,
  deleteProcess,
  type ProcessFilters,
} from "../services/processesService";

export function useJuridicoProcesses(filters?: ProcessFilters) {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  const orgIds =
    holdingMode && activeOrgIds.length > 0
      ? activeOrgIds
      : currentOrg?.id
        ? [currentOrg.id]
        : [];
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["juridico_processes", orgIds, filters],
    enabled: orgIds.length > 0,
    queryFn: () => listProcesses(orgIds, filters),
  });

  const upsert = useMutation({
    mutationFn: (input: any) => upsertProcess(currentOrg!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_processes"] });
      toast.success("Processo salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProcess(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_processes"] });
      toast.success("Processo excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { list, upsert, remove };
}
