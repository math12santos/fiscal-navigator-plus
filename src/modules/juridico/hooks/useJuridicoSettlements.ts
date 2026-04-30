import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import {
  listSettlements,
  createSettlement,
  approveSettlement,
  type CreateSettlementInput,
} from "../services/settlementsService";

export function useJuridicoSettlements(processId?: string) {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["juridico_settlements", currentOrg?.id, processId],
    enabled: !!currentOrg?.id,
    queryFn: () => listSettlements(currentOrg!.id, processId),
  });

  const create = useMutation({
    mutationFn: (input: CreateSettlementInput) => createSettlement(currentOrg!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_settlements"] });
      toast.success("Acordo criado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar acordo"),
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveSettlement(id),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["juridico_settlements"] });
      qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
      toast.success(
        `Acordo aprovado. ${data?.parcelas_geradas ?? 0} parcelas geradas no fluxo de caixa.`
      );
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao aprovar"),
  });

  return { list, create, approve };
}
