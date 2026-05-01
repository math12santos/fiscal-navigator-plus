import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SupportTicket {
  id: string;
  organization_id: string | null;
  opened_by: string;
  subject: string;
  body: string | null;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  category: string | null;
  channel: "in_app" | "email" | "chat" | "phone";
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  attachments: any[];
  created_at: string;
}

export function useSupportTickets(filters?: { status?: string; priority?: string }) {
  return useQuery({
    queryKey: ["support_tickets", filters],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filters?.status && filters.status !== "__all__") q = q.eq("status", filters.status);
      if (filters?.priority && filters.priority !== "__all__") q = q.eq("priority", filters.priority);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SupportTicket[];
    },
    staleTime: 60 * 1000,
  });
}

export function useTicketMessages(ticketId: string | null) {
  return useQuery({
    queryKey: ["support_ticket_messages", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages" as any)
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SupportTicketMessage[];
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<SupportTicket> }) => {
      const patch: any = { ...input.patch };
      if (patch.status === "resolved" || patch.status === "closed") {
        patch.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("support_tickets" as any)
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support_tickets"] });
    },
  });
}

export function usePostTicketMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { ticket_id: string; body: string; is_internal?: boolean }) => {
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase.from("support_ticket_messages" as any).insert({
        ticket_id: input.ticket_id,
        author_id: user.id,
        body: input.body,
        is_internal: input.is_internal ?? false,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["support_ticket_messages", vars.ticket_id] });
      qc.invalidateQueries({ queryKey: ["support_tickets"] });
    },
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      subject: string;
      body?: string;
      priority?: SupportTicket["priority"];
      category?: string;
      organization_id?: string | null;
    }) => {
      if (!user) throw new Error("not authenticated");
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .insert({
          subject: input.subject,
          body: input.body ?? null,
          priority: input.priority ?? "normal",
          category: input.category ?? null,
          organization_id: input.organization_id ?? null,
          opened_by: user.id,
          channel: "in_app",
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SupportTicket;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support_tickets"] });
    },
  });
}
