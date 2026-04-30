import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { toast } from "sonner";

export function useITSystems() {
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
    queryKey: ["it_systems", orgIds],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_systems" as any)
        .select("*")
        .in("organization_id", orgIds)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input, organization_id: currentOrg!.id };
      Object.keys(payload).forEach((k) => {
        if (k.endsWith("_id") && payload[k] === "") payload[k] = null;
      });
      if (input.id) {
        const { data, error } = await supabase.from("it_systems" as any).update(payload).eq("id", input.id).select().single();
        if (error) throw error;
        return data;
      }
      payload.created_by = u.user?.id;
      const { data, error } = await supabase.from("it_systems" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_systems"] });
      toast.success("Sistema salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("it_systems" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_systems"] });
      toast.success("Sistema excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { list, upsert, remove };
}
