import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface ChatBinding {
  id: string;
  organization_id: string;
  channel: "telegram" | "slack";
  chat_id: string;
  label: string;
  active: boolean;
  created_at: string;
}

export function useChatBindings() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["org_chat_bindings", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_chat_bindings")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChatBinding[];
    },
  });

  const create = useMutation({
    mutationFn: async (b: { channel: "telegram" | "slack"; chat_id: string; label: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("org_chat_bindings").insert({
        organization_id: currentOrg!.id,
        channel: b.channel,
        chat_id: b.chat_id,
        label: b.label,
        created_by: u.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org_chat_bindings"] }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("org_chat_bindings").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org_chat_bindings"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_chat_bindings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org_chat_bindings"] }),
  });

  return { bindings: data, isLoading, create, toggle, remove };
}
