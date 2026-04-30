import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

export function useITConfig() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const config = useQuery({
    queryKey: ["it_config", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_config" as any)
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const save = useMutation({
    mutationFn: async (input: any) => {
      const payload: any = { ...input, organization_id: currentOrg!.id };
      if (input?.id) {
        const { data, error } = await supabase.from("it_config" as any).update(payload).eq("id", input.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("it_config" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_config"] });
      toast.success("Configurações salvas");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return { config, save };
}
