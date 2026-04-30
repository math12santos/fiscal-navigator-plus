import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

const sanitize = (payload: any) => {
  Object.keys(payload).forEach((k) => {
    if (k.endsWith("_id") && payload[k] === "") payload[k] = null;
  });
  return payload;
};

// ============ PROCESSES ============
export function useJuridicoProcesses(filters?: { status?: string; probabilidade?: string }) {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["juridico_processes", currentOrg?.id, filters],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      let q = supabase.from("juridico_processes" as any).select("*").eq("organization_id", currentOrg!.id);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.probabilidade) q = q.eq("probabilidade", filters.probabilidade);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload = sanitize({ ...input, organization_id: currentOrg!.id });
      if (input.id) {
        const { data, error } = await supabase.from("juridico_processes" as any).update(payload).eq("id", input.id).select().single();
        if (error) throw error;
        return data;
      }
      payload.user_id = u.user?.id;
      const { data, error } = await supabase.from("juridico_processes" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_processes"] });
      toast.success("Processo salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("juridico_processes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_processes"] });
      toast.success("Processo excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { list, upsert, remove };
}

// ============ SETTLEMENTS ============
export function useJuridicoSettlements(processId?: string) {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["juridico_settlements", currentOrg?.id, processId],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      let q = supabase.from("juridico_settlements" as any).select("*").eq("organization_id", currentOrg!.id);
      if (processId) q = q.eq("process_id", processId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: any & { installments: { numero_parcela: number; valor: number; data_vencimento: string }[] }) => {
      const { data: u } = await supabase.auth.getUser();
      const { installments, ...rest } = input;
      const payload = sanitize({ ...rest, organization_id: currentOrg!.id, user_id: u.user?.id });
      const { data: settle, error } = await supabase.from("juridico_settlements" as any).insert(payload).select().single();
      if (error) throw error;
      const instPayload = installments.map((i) => ({ ...i, organization_id: currentOrg!.id, settlement_id: (settle as any).id }));
      const { error: e2 } = await supabase.from("juridico_settlement_installments" as any).insert(instPayload);
      if (e2) throw e2;
      return settle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_settlements"] });
      toast.success("Acordo criado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar acordo"),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("juridico_approve_settlement" as any, { p_settlement_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["juridico_settlements"] });
      qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
      toast.success(`Acordo aprovado. ${data?.parcelas_geradas ?? 0} parcelas geradas no fluxo de caixa.`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao aprovar"),
  });

  return { list, create, approve };
}

// ============ EXPENSES ============
export function useJuridicoExpenses(processId?: string) {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["juridico_expenses", currentOrg?.id, processId],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      let q = supabase.from("juridico_expenses" as any).select("*").eq("organization_id", currentOrg!.id);
      if (processId) q = q.eq("process_id", processId);
      const { data, error } = await q.order("data_despesa", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload = sanitize({ ...input, organization_id: currentOrg!.id });
      if (input.id) {
        const { data, error } = await supabase.from("juridico_expenses" as any).update(payload).eq("id", input.id).select().single();
        if (error) throw error;
        return data;
      }
      payload.user_id = u.user?.id;
      const { data, error } = await supabase.from("juridico_expenses" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_expenses"] });
      toast.success("Despesa salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const postToCashflow = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("juridico_post_expense_to_cashflow" as any, { p_expense_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_expenses"] });
      qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
      toast.success("Despesa lançada no fluxo de caixa");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao lançar"),
  });

  return { list, upsert, postToCashflow };
}

// ============ CONFIG ============
export function useJuridicoConfig() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const get = useQuery({
    queryKey: ["juridico_config", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("juridico_config" as any).select("*").eq("organization_id", currentOrg!.id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const payload = sanitize({ ...input, organization_id: currentOrg!.id });
      const { data, error } = await supabase.from("juridico_config" as any).upsert(payload, { onConflict: "organization_id" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_config"] });
      toast.success("Configuração salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return { get, upsert };
}
