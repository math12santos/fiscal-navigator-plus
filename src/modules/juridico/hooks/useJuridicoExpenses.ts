import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { toast } from "sonner";
import {
  listExpenses,
  upsertExpense,
  postExpenseToCashflow,
} from "../services/expensesService";

export function useJuridicoExpenses(processId?: string) {
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
    queryKey: ["juridico_expenses", orgIds, processId],
    enabled: orgIds.length > 0,
    queryFn: () => listExpenses(orgIds, processId),
  });

  const upsert = useMutation({
    mutationFn: (input: any) => upsertExpense(currentOrg!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_expenses"] });
      toast.success("Despesa salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const postToCashflow = useMutation({
    mutationFn: (id: string) => postExpenseToCashflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_expenses"] });
      qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
      toast.success("Despesa lançada no fluxo de caixa");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao lançar"),
  });

  return { list, upsert, postToCashflow };
}
