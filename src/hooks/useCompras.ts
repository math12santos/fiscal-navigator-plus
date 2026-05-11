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
  quotations: ["compras", "quotations", orgId],
  receipts: ["compras", "receipts", orgId],
  divergences: ["compras", "divergences", orgId],
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

// ========== QUOTATIONS (Fase 2) ==========
export function usePurchaseQuotations(requestId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = [...T(orgId).quotations, requestId ?? "all"];

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      let q = supabase
        .from("purchase_quotations" as any)
        .select("*, supplier:suppliers(razao_social, nome_fantasia), request:purchase_requests(codigo, titulo), items:purchase_quotation_items(*)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (requestId) q = q.eq("request_id", requestId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ items, ...input }: any) => {
      const payload = { ...input, organization_id: orgId, created_by: input.created_by || user!.id };
      const { data: quot, error } = input.id
        ? await supabase.from("purchase_quotations" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_quotations" as any).insert(payload).select("*").single();
      if (error) throw error;
      const quotId = (quot as any).id;
      if (Array.isArray(items)) {
        await supabase.from("purchase_quotation_items" as any).delete().eq("quotation_id", quotId);
        if (items.length) {
          await supabase.from("purchase_quotation_items" as any).insert(
            items.map((it: any, i: number) => ({
              quotation_id: quotId,
              ordem: i + 1,
              nome: it.nome,
              quantidade: it.quantidade ?? 1,
              unidade: it.unidade ?? "un",
              valor_unitario: it.valor_unitario ?? 0,
              valor_total: (it.quantidade ?? 1) * (it.valor_unitario ?? 0),
              observacao: it.observacao,
              request_item_id: it.request_item_id ?? null,
            })),
          );
        }
      }
      return quot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: T(orgId).quotations });
      qc.invalidateQueries({ queryKey: T(orgId).requests });
      toast({ title: "Cotação salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const choose = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_quotations" as any)
        .update({ status: "escolhida", decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: T(orgId).quotations });
      qc.invalidateQueries({ queryKey: T(orgId).requests });
      toast({ title: "Cotação escolhida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_quotations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: T(orgId).quotations }); toast({ title: "Cotação excluída" }); },
  });

  return { quotations, isLoading, upsert, choose, remove };
}

// ========== RECEIPTS (Fase 2) ==========
export function usePurchaseReceipts(orderId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = [...T(orgId).receipts, orderId ?? "all"];

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      let q = supabase
        .from("purchase_receipts" as any)
        .select("*, order:purchase_orders(codigo, supplier:suppliers(razao_social)), items:purchase_receipt_items(*)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (orderId) q = q.eq("order_id", orderId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ items, ...input }: any) => {
      const payload = { ...input, organization_id: orgId, created_by: input.created_by || user!.id, recebido_por: input.recebido_por || user!.id };
      const { data: rec, error } = input.id
        ? await supabase.from("purchase_receipts" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_receipts" as any).insert(payload).select("*").single();
      if (error) throw error;
      const recId = (rec as any).id;
      if (Array.isArray(items)) {
        await supabase.from("purchase_receipt_items" as any).delete().eq("receipt_id", recId);
        if (items.length) {
          await supabase.from("purchase_receipt_items" as any).insert(
            items.map((it: any, i: number) => ({
              receipt_id: recId,
              order_item_id: it.order_item_id ?? null,
              ordem: i + 1,
              nome: it.nome,
              quantidade_pedida: it.quantidade_pedida ?? 0,
              quantidade_recebida: it.quantidade_recebida ?? 0,
              unidade: it.unidade ?? "un",
              valor_unitario: it.valor_unitario ?? 0,
              valor_total: (it.quantidade_recebida ?? 0) * (it.valor_unitario ?? 0),
              status_item: it.status_item ?? "ok",
              observacao: it.observacao,
            })),
          );
        }
      }
      return rec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: T(orgId).receipts });
      qc.invalidateQueries({ queryKey: T(orgId).orders });
      toast({ title: "Recebimento salvo" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_receipts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: T(orgId).receipts });
      qc.invalidateQueries({ queryKey: T(orgId).orders });
      toast({ title: "Recebimento excluído" });
    },
  });

  return { receipts, isLoading, upsert, remove };
}

// ========== DIVERGENCES (Fase 2) ==========
export function usePurchaseDivergences(receiptId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = [...T(orgId).divergences, receiptId ?? "all"];

  const { data: divergences = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      let q = supabase
        .from("purchase_divergences" as any)
        .select("*, receipt:purchase_receipts(codigo), order:purchase_orders(codigo)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (receiptId) q = q.eq("receipt_id", receiptId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const payload = { ...input, organization_id: orgId, created_by: input.created_by || user!.id };
      const { data, error } = input.id
        ? await supabase.from("purchase_divergences" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_divergences" as any).insert(payload).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: T(orgId).divergences });
      qc.invalidateQueries({ queryKey: T(orgId).orders });
      toast({ title: "Divergência salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resolve = useMutation({
    mutationFn: async ({ id, acao_corretiva }: { id: string; acao_corretiva?: string }) => {
      const { error } = await supabase
        .from("purchase_divergences" as any)
        .update({ status: "resolvida", resolvida_em: new Date().toISOString(), resolvida_por: user!.id, acao_corretiva })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: T(orgId).divergences });
      qc.invalidateQueries({ queryKey: T(orgId).orders });
      toast({ title: "Divergência resolvida" });
    },
  });

  return { divergences, isLoading, upsert, resolve };
}

export const STATUS_QUOTATION: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  em_analise: { label: "Em análise", variant: "secondary" },
  recebida: { label: "Recebida", variant: "secondary" },
  escolhida: { label: "Escolhida", variant: "default" },
  descartada: { label: "Descartada", variant: "outline" },
  expirada: { label: "Expirada", variant: "destructive" },
};

export const STATUS_RECEIPT: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  parcial: { label: "Parcial", variant: "outline" },
  total: { label: "Total", variant: "default" },
  divergente: { label: "Divergente", variant: "destructive" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

export const TIPOS_DIVERGENCIA = [
  { value: "quantidade", label: "Quantidade" },
  { value: "preco", label: "Preço" },
  { value: "qualidade", label: "Qualidade" },
  { value: "atraso", label: "Atraso" },
  { value: "item_errado", label: "Item errado" },
  { value: "nf_divergente", label: "NF divergente" },
  { value: "outro", label: "Outro" },
];

export const STATUS_DIVERGENCIA: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberta: { label: "Aberta", variant: "destructive" },
  em_negociacao: { label: "Em negociação", variant: "secondary" },
  resolvida: { label: "Resolvida", variant: "default" },
  escalada: { label: "Escalada", variant: "destructive" },
};

// ========== RECURRENCES (Fase 3) ==========
export function usePurchaseRecurrences() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = ["compras", "recurrences", orgId];

  const { data: recurrences = [], isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_recurrences" as any)
        .select("*, supplier:suppliers(razao_social)")
        .eq("organization_id", orgId!)
        .order("proxima_geracao", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: any) => {
      const payload = { ...input, organization_id: orgId, created_by: input.created_by || user!.id };
      const { data, error } = input.id
        ? await supabase.from("purchase_recurrences" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_recurrences" as any).insert(payload).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Recorrência salva" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_recurrences" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Recorrência excluída" }); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("purchase_recurrences" as any).update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k }),
  });

  const generateNow = useMutation({
    mutationFn: async (horizonteDias: number = 30) => {
      const { data, error } = await (supabase.rpc as any)("fn_generate_recurring_purchases", {
        _org: orgId, _horizonte_dias: horizonteDias,
      });
      if (error) throw error;
      return data as any[];
    },
    onSuccess: (data: any[]) => {
      qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: ["compras", "requests", orgId] });
      toast({ title: `${data?.length ?? 0} solicitações geradas` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { recurrences, isLoading, upsert, remove, toggleActive, generateNow };
}

// ========== SETTINGS (Fase 3) ==========
export function usePurchaseSettings() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const k = ["compras", "settings", orgId];

  const { data: settings, isLoading } = useQuery({
    queryKey: k,
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_settings" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const save = useMutation({
    mutationFn: async (input: any) => {
      const payload = { ...input, organization_id: orgId };
      const { data, error } = input.id
        ? await supabase.from("purchase_settings" as any).update(payload).eq("id", input.id).select("*").single()
        : await supabase.from("purchase_settings" as any).insert(payload).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: k }); toast({ title: "Configurações salvas" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { settings, isLoading, save };
}

export const PERIODICIDADES = [
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];
