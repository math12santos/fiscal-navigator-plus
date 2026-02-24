import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

// ========== TYPES ==========
export interface CRMClient {
  id: string;
  organization_id: string;
  user_id: string;
  entity_id: string | null;
  name: string;
  document_number: string | null;
  segment: string | null;
  responsible: string | null;
  status: string;
  origin: string | null;
  score: number;
  health_score: number;
  engagement: string;
  churn_risk: string;
  mrr: number;
  estimated_margin: number;
  last_contact_at: string | null;
  next_action_at: string | null;
  next_action_type: string | null;
  next_action_description: string | null;
  contract_start_date: string | null;
  contract_renewal_date: string | null;
  notes: string | null;
  tags: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CRMActivity {
  id: string;
  organization_id: string;
  user_id: string;
  client_id: string;
  type: string;
  description: string;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  order_index: number;
  probability: number;
  avg_days: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
}

export interface CRMOpportunity {
  id: string;
  organization_id: string;
  user_id: string;
  client_id: string;
  stage_id: string;
  title: string;
  estimated_value: number;
  estimated_close_date: string | null;
  contract_type: string | null;
  recurrence: string;
  responsible: string | null;
  notes: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  contract_id: string | null;
  created_at: string;
  updated_at: string;
}

// ========== CLIENTS ==========
export function useCRMClients() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["crm_clients", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_clients" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CRMClient[];
    },
    enabled: !!user && !!orgId,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<CRMClient>) => {
      const { error } = await supabase.from("crm_clients" as any).insert({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_clients", orgId] });
      toast({ title: "Cliente criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CRMClient>) => {
      const { error } = await supabase.from("crm_clients" as any).update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_clients", orgId] });
      toast({ title: "Cliente atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_clients" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_clients", orgId] });
      toast({ title: "Cliente removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { clients: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}

// ========== ACTIVITIES ==========
export function useCRMActivities(clientId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["crm_activities", orgId, clientId],
    queryFn: async () => {
      let q = supabase
        .from("crm_activities" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CRMActivity[];
    },
    enabled: !!user && !!orgId,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<CRMActivity>) => {
      const { error } = await supabase.from("crm_activities" as any).insert({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_activities", orgId] });
      toast({ title: "Atividade registrada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { activities: query.data ?? [], isLoading: query.isLoading, create };
}

// ========== PIPELINE STAGES ==========
export function usePipelineStages() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["crm_pipeline_stages", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipeline_stages" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as unknown as PipelineStage[];
    },
    enabled: !!user && !!orgId,
  });

  return { stages: query.data ?? [], isLoading: query.isLoading };
}

// ========== OPPORTUNITIES ==========
export function useCRMOpportunities() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["crm_opportunities", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_opportunities" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CRMOpportunity[];
    },
    enabled: !!user && !!orgId,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<CRMOpportunity>) => {
      const { error } = await supabase.from("crm_opportunities" as any).insert({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_opportunities", orgId] });
      toast({ title: "Oportunidade criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CRMOpportunity>) => {
      const { error } = await supabase.from("crm_opportunities" as any).update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_opportunities", orgId] });
      toast({ title: "Oportunidade atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_opportunities" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_opportunities", orgId] });
      toast({ title: "Oportunidade removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const moveToStage = useMutation({
    mutationFn: async ({ id, stage_id, won_at, lost_at, lost_reason }: {
      id: string; stage_id: string; won_at?: string | null; lost_at?: string | null; lost_reason?: string | null;
    }) => {
      const updateData: any = { stage_id };
      if (won_at !== undefined) updateData.won_at = won_at;
      if (lost_at !== undefined) updateData.lost_at = lost_at;
      if (lost_reason !== undefined) updateData.lost_reason = lost_reason;
      const { error } = await supabase.from("crm_opportunities" as any).update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_opportunities", orgId] });
    },
    onError: (e: any) => toast({ title: "Erro ao mover", description: e.message, variant: "destructive" }),
  });

  return {
    opportunities: query.data ?? [],
    isLoading: query.isLoading,
    create, update, remove, moveToStage,
  };
}
