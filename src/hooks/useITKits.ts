import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cachePresets } from "@/lib/cachePresets";

export interface ITKit {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  active: boolean;
}
export interface ITKitItem {
  id: string;
  kit_id: string;
  equipment_type: string;
  equipment_subtype: string | null;
  quantity: number;
  suggested_specs: Record<string, any>;
  notes: string | null;
}

export function useITKits() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgIds =
    holdingMode && activeOrgIds.length > 0 ? activeOrgIds : currentOrg?.id ? [currentOrg.id] : [];

  const list = useQuery({
    queryKey: ["it_kits", orgIds],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_equipment_kits" as any)
        .select("*, items:it_equipment_kit_items(*)")
        .in("organization_id", orgIds)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    ...cachePresets.reference,
  });

  const upsertKit = useMutation({
    mutationFn: async (input: Partial<ITKit> & { items?: Partial<ITKitItem>[] }) => {
      const { items, id, ...kitData } = input;
      let kitId = id;
      if (id) {
        const { error } = await supabase
          .from("it_equipment_kits" as any)
          .update(kitData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("it_equipment_kits" as any)
          .insert({ ...kitData, organization_id: currentOrg!.id, created_by: user!.id })
          .select("id")
          .single();
        if (error) throw error;
        kitId = (data as any).id;
      }
      if (items) {
        await supabase.from("it_equipment_kit_items" as any).delete().eq("kit_id", kitId!);
        if (items.length > 0) {
          const rows = items.map((i) => ({
            kit_id: kitId,
            equipment_type: i.equipment_type,
            equipment_subtype: i.equipment_subtype || null,
            quantity: i.quantity || 1,
            suggested_specs: i.suggested_specs || {},
            notes: i.notes || null,
          }));
          const { error } = await supabase.from("it_equipment_kit_items" as any).insert(rows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_kits"] });
      toast.success("Kit salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar kit"),
  });

  const removeKit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("it_equipment_kits" as any)
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["it_kits"] }),
  });

  const assign = useMutation({
    mutationFn: async (input: { kit_id: string; employee_id: string; notes?: string }) => {
      const { data, error } = await supabase.rpc("it_assign_kit_to_employee" as any, {
        p_kit_id: input.kit_id,
        p_employee_id: input.employee_id,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["it_equipment"] });
      qc.invalidateQueries({ queryKey: ["it_kit_assignments"] });
      qc.invalidateQueries({ queryKey: ["it_equipment_by_employee"] });
      const missing = (data?.missing ?? []).length;
      toast.success(
        `Kit atribuído: ${data?.allocated ?? 0} alocados${missing ? `, ${missing} pendente(s)` : ""}`
      );
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atribuir kit"),
  });

  return { list, upsertKit, removeKit, assign };
}

export function useEquipmentByEmployee() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  const orgIds =
    holdingMode && activeOrgIds.length > 0 ? activeOrgIds : currentOrg?.id ? [currentOrg.id] : [];
  return useQuery({
    queryKey: ["it_equipment_by_employee", orgIds],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_equipment_by_employee" as any)
        .select("*")
        .in("organization_id", orgIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    ...cachePresets.operational,
  });
}

export function useITLifecycleAlerts() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["it_lifecycle_alerts", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("it_get_lifecycle_alerts" as any, {
        p_org_id: currentOrg!.id,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    ...cachePresets.operational,
  });
}
