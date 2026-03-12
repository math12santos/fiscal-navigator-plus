import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface Request {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  type: string;
  area_responsavel: string | null;
  assigned_to: string | null;
  description: string | null;
  priority: string;
  due_date: string | null;
  cost_center_id: string | null;
  reference_module: string | null;
  reference_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Governance fields
  entity_id: string | null;
  account_id: string | null;
  competencia: string | null;
  data_vencimento: string | null;
  justificativa: string | null;
  classified_by: string | null;
  classified_at: string | null;
  cashflow_entry_id: string | null;
}

export interface RequestTask {
  id: string;
  request_id: string;
  organization_id: string;
  title: string;
  assigned_to: string | null;
  status: string;
  due_date: string | null;
  created_by: string;
  executed_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

interface RequestFilters {
  type?: string;
  status?: string;
  priority?: string;
  area?: string;
}

export function useRequests(filters?: RequestFilters) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ["requests", orgId, filters],
    queryFn: async () => {
      let query = supabase
        .from("requests" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });

      if (filters?.type) query = query.eq("type", filters.type);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.priority) query = query.eq("priority", filters.priority);
      if (filters?.area) query = query.eq("area_responsavel", filters.area);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Request[];
    },
    enabled: !!user && !!orgId,
  });
}

export function useMyTasks() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ["my_request_tasks", orgId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_tasks" as any)
        .select("*, requests:request_id(*)")
        .eq("organization_id", orgId!)
        .eq("assigned_to", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (RequestTask & { requests: Request })[];
    },
    enabled: !!user && !!orgId,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (input: Partial<Request>) => {
      const { data, error } = await supabase
        .from("requests" as any)
        .insert({
          ...input,
          user_id: user!.id,
          organization_id: currentOrg!.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-create a task if assigned_to is set
      const req = data as any;
      if (req.assigned_to) {
        await supabase.from("request_tasks" as any).insert({
          request_id: req.id,
          organization_id: currentOrg!.id,
          title: req.title,
          assigned_to: req.assigned_to,
          due_date: req.due_date,
          created_by: user!.id,
        });

        // Create notification for assignee
        await supabase.from("notifications" as any).insert({
          organization_id: currentOrg!.id,
          user_id: req.assigned_to,
          title: "Nova solicitação atribuída",
          body: req.title,
          type: "assignment",
          priority: req.priority,
          reference_type: "request",
          reference_id: req.id,
        });
      }

      // Log comment
      await supabase.from("request_comments" as any).insert({
        request_id: req.id,
        user_id: user!.id,
        content: "Solicitação criada",
        type: "status_change",
        new_value: "aberta",
      });

      return req as Request;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["my_request_tasks"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Request> & { id: string }) => {
      // Get old values for history
      const { data: old } = await supabase
        .from("requests" as any)
        .select("status, assigned_to")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("requests" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      const oldData = old as any;
      const newData = data as any;

      // Log status change
      if (updates.status && oldData?.status !== updates.status) {
        await supabase.from("request_comments" as any).insert({
          request_id: id,
          user_id: user!.id,
          content: `Status alterado de "${oldData?.status}" para "${updates.status}"`,
          type: "status_change",
          old_value: oldData?.status,
          new_value: updates.status,
        });
      }

      // Log reassignment
      if (updates.assigned_to && oldData?.assigned_to !== updates.assigned_to) {
        await supabase.from("request_comments" as any).insert({
          request_id: id,
          user_id: user!.id,
          content: "Responsável alterado",
          type: "assignment",
          old_value: oldData?.assigned_to,
          new_value: updates.assigned_to,
        });

        // Notify new assignee
        await supabase.from("notifications" as any).insert({
          organization_id: currentOrg!.id,
          user_id: updates.assigned_to,
          title: "Solicitação reatribuída para você",
          body: newData.title,
          type: "assignment",
          priority: newData.priority,
          reference_type: "request",
          reference_id: id,
        });
      }

      return newData as Request;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["my_request_tasks"] });
      qc.invalidateQueries({ queryKey: ["request_comments"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RequestTask> & { id: string }) => {
      const { data, error } = await supabase
        .from("request_tasks" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RequestTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_request_tasks"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
