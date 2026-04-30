import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { toast } from "sonner";

export function useITMovements(equipmentId?: string) {
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
    queryKey: ["it_movements", orgIds, equipmentId],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("it_equipment_movements" as any)
        .select("*")
        .in("organization_id", orgIds)
        .order("movement_date", { ascending: false });
      if (equipmentId) q = q.eq("equipment_id", equipmentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        ...input,
        organization_id: currentOrg!.id,
        performed_by: u.user?.id,
      };
      Object.keys(payload).forEach((k) => {
        if (k.endsWith("_id") && payload[k] === "") payload[k] = null;
      });
      const { data, error } = await supabase
        .from("it_equipment_movements" as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_movements"] });
      qc.invalidateQueries({ queryKey: ["it_equipment"] });
      toast.success("Movimentação registrada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar movimentação"),
  });

  return { list, create };
}
