import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import {
  listEquipment,
  upsertEquipment,
  deleteEquipment,
} from "../services/equipmentService";
import type { ITEquipment } from "../domain/types";

export function useITEquipment() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["it_equipment", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: () => listEquipment(currentOrg!.id),
  });

  const upsert = useMutation({
    mutationFn: (input: Partial<ITEquipment> & { id?: string }) =>
      upsertEquipment(currentOrg!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_equipment"] });
      qc.invalidateQueries({ queryKey: ["it_depreciation"] });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Equipamento salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_equipment"] });
      toast.success("Equipamento excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { list, upsert, remove };
}
