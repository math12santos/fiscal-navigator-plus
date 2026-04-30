import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import {
  listProcesses,
  upsertProcess,
  deleteProcess,
  type ProcessFilters,
} from "../services/processesService";

export function useJuridicoProcesses(filters?: ProcessFilters) {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["juridico_processes", currentOrg?.id, filters],
    enabled: !!currentOrg?.id,
    queryFn: () => listProcesses(currentOrg!.id, filters),
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
