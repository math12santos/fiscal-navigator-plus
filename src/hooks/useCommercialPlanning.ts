import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface CommercialPlan {
  id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  mode: string;
  period_months: number;
  budget_approved: number;
  budget_requested: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommercialBudgetLine {
  id: string;
  plan_id: string;
  organization_id: string | null;
  user_id: string;
  category: string;
  subcategory: string | null;
  description: string;
  quantidade: number;
  valor_unitario: number;
  encargos_pct: number;
  beneficios: number;
  valor_mensal: number;
  valor_total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommercialChannel {
  id: string;
  plan_id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  is_custom: boolean;
  orcamento_alocado: number;
  cpl_estimado: number;
  cpa_estimado: number;
  leads_projetados: number;
  conv_lead_oportunidade: number;
  conv_oportunidade_proposta: number;
  conv_proposta_fechamento: number;
  ticket_medio: number;
  ciclo_medio_dias: number;
  tipo_contrato: string;
  mrr: number;
  duracao_media_meses: number;
  comissao_pct: number;
  comissao_tipo: string;
  comissao_valor_fixo: number;
  channel_type: string;
  created_at: string;
  updated_at: string;
}

export interface CommercialScenario {
  id: string;
  plan_id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  type: string;
  ajuste_conversao: number;
  ajuste_ticket: number;
  ajuste_cpl: number;
  ajuste_ciclo: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Helper to compute channel projections ───
export function computeChannelProjections(
  ch: CommercialChannel,
  scenario?: CommercialScenario | null,
  periodMonths: number = 12
) {
  const adjConv = 1 + (scenario?.ajuste_conversao ?? 0) / 100;
  const adjTicket = 1 + (scenario?.ajuste_ticket ?? 0) / 100;

  const leads = ch.leads_projetados;
  const oportunidades = Math.round(leads * (ch.conv_lead_oportunidade / 100) * adjConv);
  const propostas = Math.round(oportunidades * (ch.conv_oportunidade_proposta / 100) * adjConv);
  const vendas = Math.round(propostas * (ch.conv_proposta_fechamento / 100) * adjConv);
  const ticket = ch.ticket_medio * adjTicket;

  let receita: number;
  if (ch.tipo_contrato === "recorrente") {
    receita = vendas * ch.mrr * Math.min(ch.duracao_media_meses, periodMonths);
  } else {
    receita = vendas * ticket;
  }

  const comissao = ch.comissao_tipo === "fixo"
    ? (ch.comissao_valor_fixo ?? 0) * vendas
    : receita * (ch.comissao_pct / 100);
  const custoTotal = ch.orcamento_alocado;
  const roi = custoTotal > 0 ? ((receita - custoTotal) / custoTotal) * 100 : 0;
  const burnMensal = custoTotal / periodMonths;
  const payback = burnMensal > 0 ? custoTotal / (receita / periodMonths) : Infinity;

  return { leads, oportunidades, propostas, vendas, ticket, receita, comissao, custoTotal, roi, payback };
}

// ─── Main Hook ───
export function useCommercialPlanning() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  // Plans
  const plansQuery = useQuery({
    queryKey: ["commercial_plans", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_plans" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CommercialPlan[];
    },
    enabled: !!user && !!orgId,
  });

  const createPlan = useMutation({
    mutationFn: async (input: Partial<CommercialPlan>) => {
      const { data, error } = await supabase
        .from("commercial_plans" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CommercialPlan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_plans", orgId] });
      toast({ title: "Plano criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CommercialPlan>) => {
      const { error } = await supabase
        .from("commercial_plans" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_plans", orgId] });
      toast({ title: "Plano atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commercial_plans" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_plans", orgId] });
      toast({ title: "Plano removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { plans: plansQuery.data ?? [], isLoadingPlans: plansQuery.isLoading, createPlan, updatePlan, deletePlan };
}

// ─── Budget Lines Hook ───
export function useCommercialBudgetLines(planId: string | null) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["commercial_budget_lines", orgId, planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_budget_lines" as any)
        .select("*")
        .eq("plan_id", planId!)
        .order("category", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommercialBudgetLine[];
    },
    enabled: !!user && !!orgId && !!planId,
  });

  const createLine = useMutation({
    mutationFn: async (input: Partial<CommercialBudgetLine>) => {
      const { data, error } = await supabase
        .from("commercial_budget_lines" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CommercialBudgetLine;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_budget_lines", orgId, planId] });
      toast({ title: "Linha adicionada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateLine = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CommercialBudgetLine>) => {
      const { error } = await supabase
        .from("commercial_budget_lines" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["commercial_budget_lines", orgId, planId] });
      const prev = qc.getQueryData<CommercialBudgetLine[]>(["commercial_budget_lines", orgId, planId]);
      qc.setQueryData<CommercialBudgetLine[]>(["commercial_budget_lines", orgId, planId], (old) =>
        (old ?? []).map((l) => l.id === variables.id ? { ...l, ...variables } : l)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["commercial_budget_lines", orgId, planId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["commercial_budget_lines", orgId, planId] });
    },
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commercial_budget_lines" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_budget_lines", orgId, planId] });
      toast({ title: "Linha removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { lines: query.data ?? [], isLoading: query.isLoading, createLine, updateLine, deleteLine };
}

// ─── Channels Hook ───
export function useCommercialChannels(planId: string | null) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["commercial_channels", orgId, planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_channels" as any)
        .select("*")
        .eq("plan_id", planId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommercialChannel[];
    },
    enabled: !!user && !!orgId && !!planId,
  });

  const createChannel = useMutation({
    mutationFn: async (input: Partial<CommercialChannel>) => {
      const { data, error } = await supabase
        .from("commercial_channels" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CommercialChannel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_channels", orgId, planId] });
      toast({ title: "Canal adicionado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateChannel = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CommercialChannel>) => {
      const { error } = await supabase
        .from("commercial_channels" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["commercial_channels", orgId, planId] });
      const prev = qc.getQueryData<CommercialChannel[]>(["commercial_channels", orgId, planId]);
      qc.setQueryData<CommercialChannel[]>(["commercial_channels", orgId, planId], (old) =>
        (old ?? []).map((c) => c.id === variables.id ? { ...c, ...variables } : c)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["commercial_channels", orgId, planId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["commercial_channels", orgId, planId] });
    },
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commercial_channels" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_channels", orgId, planId] });
      toast({ title: "Canal removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!user || !orgId || !planId) throw new Error("Dados insuficientes");
      const defaults = [
        { name: "Google Ads", is_custom: false },
        { name: "Meta Ads", is_custom: false },
        { name: "LinkedIn Ads", is_custom: false },
        { name: "Indicação", is_custom: false },
        { name: "Orgânico", is_custom: false },
      ];
      const { error } = await supabase
        .from("commercial_channels" as any)
        .insert(
          defaults.map((d) => ({
            ...d,
            plan_id: planId,
            user_id: user.id,
            organization_id: orgId,
          })) as any
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_channels", orgId, planId] });
      toast({ title: "Canais padrão criados" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { channels: query.data ?? [], isLoading: query.isLoading, createChannel, updateChannel, deleteChannel, seedDefaults };
}

// ─── Scenarios Hook ───
export function useCommercialScenarios(planId: string | null) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["commercial_scenarios", orgId, planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_scenarios" as any)
        .select("*")
        .eq("plan_id", planId!)
        .order("type", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommercialScenario[];
    },
    enabled: !!user && !!orgId && !!planId,
  });

  const createScenario = useMutation({
    mutationFn: async (input: Partial<CommercialScenario>) => {
      const { data, error } = await supabase
        .from("commercial_scenarios" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CommercialScenario;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_scenarios", orgId, planId] });
      toast({ title: "Cenário criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateScenario = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CommercialScenario>) => {
      const { error } = await supabase
        .from("commercial_scenarios" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_scenarios", orgId, planId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commercial_scenarios" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_scenarios", orgId, planId] });
      toast({ title: "Cenário removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!user || !orgId || !planId) throw new Error("Dados insuficientes");
      const defaults = [
        { name: "Conservador", type: "conservador", ajuste_conversao: -15, ajuste_ticket: -10, ajuste_cpl: 10, ajuste_ciclo: 20 },
        { name: "Realista", type: "realista", ajuste_conversao: 0, ajuste_ticket: 0, ajuste_cpl: 0, ajuste_ciclo: 0 },
        { name: "Agressivo", type: "agressivo", ajuste_conversao: 20, ajuste_ticket: 15, ajuste_cpl: -10, ajuste_ciclo: -15 },
      ];
      const { error } = await supabase
        .from("commercial_scenarios" as any)
        .insert(
          defaults.map((d) => ({
            ...d,
            plan_id: planId,
            user_id: user.id,
            organization_id: orgId,
            is_active: true,
          })) as any
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_scenarios", orgId, planId] });
      toast({ title: "Cenários padrão criados" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { scenarios: query.data ?? [], isLoading: query.isLoading, createScenario, updateScenario, deleteScenario, seedDefaults };
}
