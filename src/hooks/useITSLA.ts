import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { toast } from "sonner";

export function useITSLA() {
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
    queryKey: ["it_sla_policies", orgIds],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_sla_policies" as any)
        .select("*")
        .in("organization_id", orgIds)
        .order("priority");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        ...input,
        organization_id: currentOrg!.id,
        category: input.category || null,
      };
      if (!input.id) payload.created_by = u.user?.id;
      const { data, error } = input.id
        ? await supabase.from("it_sla_policies" as any).update(payload).eq("id", input.id).select().single()
        : await supabase.from("it_sla_policies" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_sla_policies"] });
      toast.success("Política de SLA salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("it_sla_policies" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_sla_policies"] });
      toast.success("Política removida");
    },
  });

  return { list, upsert, remove };
}

export function useITTicketComments(ticketId?: string) {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["it_ticket_comments", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_ticket_comments" as any)
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: { content: string; is_internal?: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("it_ticket_comments" as any)
        .insert({
          organization_id: currentOrg!.id,
          ticket_id: ticketId!,
          author_id: u.user?.id,
          content: input.content,
          is_internal: input.is_internal ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_ticket_comments", ticketId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao comentar"),
  });

  return { list, create };
}
