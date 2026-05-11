import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cachePresets } from "@/lib/cachePresets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

const T = (orgId?: string) => ({
  suppliers: ["compras", "suppliers", orgId],
  requests: ["compras", "requests", orgId],
  approvals: ["compras", "approvals", orgId],
  orders: ["compras", "orders", orgId],
  rules: ["compras", "rules", orgId],
});

// ========== SUPPLIERS ==========
export function useSuppliers() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = T(orgId).suppliers;

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const payload = { ...input, organization_id: orgId, created_by: input.id ? input.created_by : user!.id };
      const { data, error } = input.id
        ? await supabase.from("suppliers" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("suppliers" as any).insert(payload).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Fornecedor salvo" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Fornecedor excluído" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { suppliers, isLoading, upsert, remove };
}

// ========== REQUESTS ==========
export function usePurchaseRequests() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = T(orgId).requests;

  const { data: requests = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests" as any)
        .select("*, items:purchase_request_items(*)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ items, ...input }: any) => {
      const payload = { ...input, organization_id: orgId, user_id: input.user_id || user!.id };
      const { data: req, error } = input.id
        ? await supabase.from("purchase_requests" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_requests" as any).insert(payload).select("*").single();
      if (error) throw error;
      const reqId = (req as any).id;
      if (Array.isArray(items)) {
        await supabase.from("purchase_request_items" as any).delete().eq("request_id", reqId);
        if (items.length) {
          await supabase.from("purchase_request_items" as any).insert(
            items.map((it: any, i: number) => ({
              request_id: reqId,
              ordem: i + 1,
              nome: it.nome,
              descricao: it.descricao,
              quantidade: it.quantidade ?? 1,
              unidade: it.unidade ?? "un",
              valor_unitario: it.valor_unitario ?? 0,
              valor_total: (it.quantidade ?? 1) * (it.valor_unitario ?? 0),
              categoria: it.categoria,
              observacao: it.observacao,
            })),
          );
        }
      }
      return req;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: T(orgId).approvals });
      toast({ title: "Solicitação salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_requests" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Excluída" }); },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_requests" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: T(orgId).approvals });
    },
  });

  return { requests, isLoading, upsert, remove, setStatus };
}

// ========== APPROVALS ==========
export function usePurchaseApprovals() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = T(orgId).approvals;

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_approvals" as any)
        .select("*, request:purchase_requests(*)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, comentario }: { id: string; status: string; comentario?: string }) => {
      const { data: appr, error } = await supabase
        .from("purchase_approvals" as any)
        .update({ status, comentario, decided_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, request:purchase_requests(*)")
        .single();
      if (error) throw error;

      const a: any = appr;
      // Se aprovado, checa se todas aprovadas → request = aprovada
      if (status === "aprovado") {
        const { data: pendentes } = await supabase
          .from("purchase_approvals" as any)
          .select("id")
          .eq("request_id", a.request_id)
          .eq("status", "pendente");
        if (!pendentes || pendentes.length === 0) {
          await supabase
            .from("purchase_requests" as any)
            .update({ status: "aprovada", decided_at: new Date().toISOString() })
            .eq("id", a.request_id);
        }
      } else if (status === "reprovado") {
        await supabase
          .from("purchase_requests" as any)
          .update({ status: "reprovada", decided_at: new Date().toISOString() })
          .eq("id", a.request_id);
      } else if (status === "ajuste_solicitado") {
        await supabase
          .from("purchase_requests" as any)
          .update({ status: "ajuste_solicitado" })
          .eq("id", a.request_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: T(orgId).requests });
      toast({ title: "Decisão registrada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const myPending = approvals.filter(
    (a: any) => a.status === "pendente" && (a.approver_user_id === user?.id || !a.approver_user_id),
  );

  return { approvals, myPending, isLoading, decide };
}

// ========== ORDERS ==========
export function usePurchaseOrders() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = T(orgId).orders;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders" as any)
        .select("*, supplier:suppliers(razao_social, nome_fantasia), items:purchase_order_items(*)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ items, ...input }: any) => {
      const payload = { ...input, organization_id: orgId, created_by: input.created_by || user!.id };
      const { data: ord, error } = input.id
        ? await supabase.from("purchase_orders" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_orders" as any).insert(payload).select("*").single();
      if (error) throw error;
      const orderId = (ord as any).id;
      if (Array.isArray(items)) {
        await supabase.from("purchase_order_items" as any).delete().eq("order_id", orderId);
        if (items.length) {
          await supabase.from("purchase_order_items" as any).insert(
            items.map((it: any, i: number) => ({
              order_id: orderId,
              ordem: i + 1,
              nome: it.nome,
              descricao: it.descricao,
              quantidade: it.quantidade ?? 1,
              unidade: it.unidade ?? "un",
              valor_unitario: it.valor_unitario ?? 0,
              valor_total: (it.quantidade ?? 1) * (it.valor_unitario ?? 0),
              observacao: it.observacao,
            })),
          );
        }
      }
      return ord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      toast({ title: "Pedido salvo" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_orders" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
    },
  });

  return { orders, isLoading, upsert, setStatus };
}

// ========== APPROVAL RULES ==========
export function useApprovalRules() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = T(orgId).rules;

  const { data: rules = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_approval_rules" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const payload = { ...input, organization_id: orgId };
      const { data, error } = input.id
        ? await supabase.from("purchase_approval_rules" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_approval_rules" as any).insert(payload).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Regra salva" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_approval_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Regra excluída" }); },
  });

  return { rules, isLoading, upsert, remove };
}

// ========== BUDGET CHECK ==========
export function useBudgetCheck() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return async (params: { cost_center_id?: string | null; account_id?: string | null; competencia: string; valor: number }) => {
    if (!orgId) return null;
    const { data, error } = await (supabase.rpc as any)("check_purchase_budget", {
      _org: orgId,
      _cost_center: params.cost_center_id ?? null,
      _account: params.account_id ?? null,
      _competencia: params.competencia,
      _valor: params.valor,
    });
    if (error) throw error;
    return data as { planejado: number; realizado: number; comprometido: number; valor_solicitado: number; saldo: number; situacao: string };
  };
}

export const TIPOS_COMPRA = [
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
  { value: "ativo_imobilizado", label: "Ativo Imobilizado" },
  { value: "consumo", label: "Material de Consumo" },
  { value: "software_saas", label: "Software / SaaS" },
  { value: "manutencao", label: "Manutenção" },
  { value: "obra", label: "Obra / Reforma" },
  { value: "recorrente", label: "Compra Recorrente" },
  { value: "emergencial", label: "Compra Emergencial" },
  { value: "investimento", label: "Investimento" },
  { value: "outro", label: "Outro" },
];

export const PRIORIDADES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export const STATUS_REQUEST: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  enviada: { label: "Enviada", variant: "secondary" },
  em_analise: { label: "Em análise", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
  reprovada: { label: "Reprovada", variant: "destructive" },
  ajuste_solicitado: { label: "Ajuste solicitado", variant: "outline" },
  em_cotacao: { label: "Em cotação", variant: "secondary" },
  pedido_gerado: { label: "Pedido gerado", variant: "default" },
  cancelada: { label: "Cancelada", variant: "outline" },
  concluida: { label: "Concluída", variant: "default" },
};

export const STATUS_ORDER: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  emitido: { label: "Emitido", variant: "secondary" },
  enviado: { label: "Enviado", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "default" },
  parcialmente_recebido: { label: "Parcial", variant: "outline" },
  recebido: { label: "Recebido", variant: "default" },
  aguardando_nf: { label: "Aguardando NF", variant: "outline" },
  nf_recebida: { label: "NF Recebida", variant: "default" },
  enviado_ap: { label: "Enviado ao AP", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  concluido: { label: "Concluído", variant: "default" },
};
