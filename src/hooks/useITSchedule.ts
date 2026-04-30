import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { toast } from "sonner";

export function useITSchedule(equipmentId?: string) {
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
    queryKey: ["it_depreciation_schedule", orgIds, equipmentId],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("it_depreciation_schedule" as any)
        .select("*")
        .in("organization_id", orgIds)
        .order("competencia", { ascending: true });
      if (equipmentId) q = q.eq("equipment_id", equipmentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const generate = useMutation({
    mutationFn: async (eqId: string) => {
      const { data, error } = await supabase.rpc("it_generate_depreciation_schedule" as any, {
        p_equipment_id: eqId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["it_depreciation_schedule"] });
      toast.success(`Cronograma gerado: ${data?.months_generated ?? 0} meses`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar cronograma"),
  });

  return { list, generate };
}

export function useITMaterialize() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const materializeRecurring = useMutation({
    mutationFn: async (monthsAhead: number = 12) => {
      const { data, error } = await supabase.rpc("it_materialize_recurring_costs" as any, {
        p_org_id: currentOrg!.id,
        p_months_ahead: monthsAhead,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success(`${data?.entries_inserted ?? 0} lançamentos projetados no fluxo de caixa`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao materializar custos"),
  });

  const materializeInstallments = useMutation({
    mutationFn: async (equipmentId: string) => {
      const { data, error } = await supabase.rpc("it_materialize_equipment_installments" as any, {
        p_equipment_id: equipmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      toast.success(`${data?.entries_inserted ?? 0} parcelas geradas`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar parcelas"),
  });

  return { materializeRecurring, materializeInstallments };
}
