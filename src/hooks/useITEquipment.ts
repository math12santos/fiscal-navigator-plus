import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

export type ITEquipment = any;

export function useITEquipment() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["it_equipment", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_equipment" as any)
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ITEquipment[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<ITEquipment> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        ...input,
        organization_id: currentOrg!.id,
      };
      // sanitize empty string ids
      Object.keys(payload).forEach((k) => {
        if (k.endsWith("_id") && payload[k] === "") payload[k] = null;
      });
      if (input.id) {
        const { data, error } = await supabase
          .from("it_equipment" as any)
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      payload.created_by = u.user?.id;
      const { data, error } = await supabase.from("it_equipment" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("it_equipment" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_equipment"] });
      toast.success("Equipamento excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { list, upsert, remove };
}
