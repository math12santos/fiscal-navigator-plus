import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cachePresets } from "@/lib/cachePresets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "./useAuditLog";

export interface ChartAccount {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: string;
  nature: string;
  accounting_class: string;
  level: number;
  parent_id: string | null;
  description: string | null;
  tags: string[] | null;
  is_synthetic: boolean;
  is_system_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type CreateInput = Omit<ChartAccount, "id" | "user_id" | "created_at" | "updated_at">;
type UpdateInput = { id: string } & Partial<CreateInput>;

export function useChartOfAccounts() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { log } = useAuditLog();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["chart_of_accounts", orgId],
    queryFn: async () => {
      let q = supabase
        .from("chart_of_accounts" as any)
        .select("*")
        .order("code", { ascending: true });
      if (orgId) q = q.eq("organization_id", orgId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as ChartAccount[];
    },
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
  });

  const create = useMutation({
    mutationFn: async (input: CreateInput) => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChartAccount;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts", orgId] });
      log({ entity_type: "chart_of_accounts", entity_id: data.id, action: "INSERT", new_data: data as any });
      toast({ title: "Conta criada com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar conta", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateInput) => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChartAccount;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts", orgId] });
      log({ entity_type: "chart_of_accounts", entity_id: data.id, action: "UPDATE", new_data: data as any });
      toast({ title: "Conta atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .update({ active })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChartAccount;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts", orgId] });
      log({
        entity_type: "chart_of_accounts",
        entity_id: data.id,
        action: data.active ? "ACTIVATE" : "DEACTIVATE",
        new_data: data as any,
      });
      toast({ title: data.active ? "Conta ativada" : "Conta desativada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts" as any).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts", orgId] });
      log({ entity_type: "chart_of_accounts", entity_id: id, action: "DELETE" });
      toast({ title: "Conta removida" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const deleteAll = async () => {
    if (!user || !orgId) throw new Error("Usuário ou organização não definidos");
    for (const level of [3, 2, 1]) {
      // Delete by org_id
      const { error: e1 } = await supabase
        .from("chart_of_accounts" as any)
        .delete()
        .eq("organization_id", orgId)
        .eq("level", level);
      if (e1) throw e1;
      // Also clean orphaned records (null org_id) for this user
      const { error: e2 } = await supabase
        .from("chart_of_accounts" as any)
        .delete()
        .eq("user_id", user.id)
        .is("organization_id", null)
        .eq("level", level);
      if (e2) throw e2;
    }
    qc.invalidateQueries({ queryKey: ["chart_of_accounts", orgId] });
  };

  const seedDefaultAccounts = async () => {
    if (!user || !orgId) throw new Error("Usuário ou organização não definidos");

    const uid = user.id;

    // Level 1
    const level1 = [
      { code: "1", name: "Receitas", type: "receita", nature: "entrada", accounting_class: "resultado" },
      { code: "2", name: "Custos dos Serviços", type: "custo", nature: "saida", accounting_class: "resultado" },
      { code: "3", name: "Despesas", type: "despesa", nature: "saida", accounting_class: "resultado" },
      { code: "4", name: "Investimentos", type: "investimento", nature: "saida", accounting_class: "ativo" },
      { code: "5", name: "Transferências", type: "transferencia", nature: "neutro", accounting_class: "resultado" },
    ];

    const { data: l1Data, error: l1Err } = await supabase
      .from("chart_of_accounts" as any)
      .insert(level1.map((a) => ({ ...a, user_id: uid, organization_id: orgId, level: 1, is_synthetic: true, is_system_default: true, active: true, parent_id: null, description: null, tags: null })))
      .select();
    if (l1Err) throw l1Err;
    const l1 = l1Data as unknown as ChartAccount[];
    const l1Map = Object.fromEntries(l1.map((a) => [a.code, a.id]));

    // Level 2
    const level2 = [
      { code: "1.1", name: "Receitas Operacionais", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1" },
      { code: "1.2", name: "Receitas Não Operacionais", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1" },
      { code: "2.1", name: "Custos Diretos", type: "custo", nature: "saida", accounting_class: "resultado", parentCode: "2" },
      { code: "3.1", name: "Despesas Administrativas", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3" },
      { code: "3.2", name: "Despesas com Pessoal", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3" },
      { code: "3.3", name: "Despesas Comerciais", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3" },
      { code: "3.4", name: "Despesas Financeiras", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3" },
      { code: "3.5", name: "Impostos e Tributos", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3" },
      { code: "4.1", name: "Investimentos Operacionais", type: "investimento", nature: "saida", accounting_class: "ativo", parentCode: "4" },
      { code: "5.1", name: "Transferências entre Contas", type: "transferencia", nature: "neutro", accounting_class: "resultado", parentCode: "5" },
    ];

    const { data: l2Data, error: l2Err } = await supabase
      .from("chart_of_accounts" as any)
      .insert(level2.map(({ parentCode, ...a }) => ({ ...a, user_id: uid, organization_id: orgId, level: 2, is_synthetic: true, is_system_default: true, active: true, parent_id: l1Map[parentCode], description: null, tags: null })))
      .select();
    if (l2Err) throw l2Err;
    const l2 = l2Data as unknown as ChartAccount[];
    const l2Map = Object.fromEntries(l2.map((a) => [a.code, a.id]));

    // Level 3
    const level3 = [
      { code: "1.1.01", name: "BPO Financeiro", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1.1" },
      { code: "1.1.02", name: "Assessoria Contábil", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1.1" },
      { code: "1.1.03", name: "Licitações e Pregões", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1.1" },
      { code: "1.1.04", name: "Consultoria Avulsa", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1.1" },
      { code: "1.2.01", name: "Receitas Financeiras (juros/aplicações)", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1.2" },
      { code: "1.2.02", name: "Outras Receitas", type: "receita", nature: "entrada", accounting_class: "resultado", parentCode: "1.2" },
      { code: "2.1.01", name: "Salários e Encargos Operacionais", type: "custo", nature: "saida", accounting_class: "resultado", parentCode: "2.1" },
      { code: "2.1.02", name: "Ferramentas e Sistemas (SaaS)", type: "custo", nature: "saida", accounting_class: "resultado", parentCode: "2.1" },
      { code: "2.1.03", name: "Subcontratação / Terceiros", type: "custo", nature: "saida", accounting_class: "resultado", parentCode: "2.1" },
      { code: "2.1.04", name: "Certificados Digitais", type: "custo", nature: "saida", accounting_class: "resultado", parentCode: "2.1" },
      { code: "3.1.01", name: "Aluguel e Condomínio", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.1" },
      { code: "3.1.02", name: "Energia e Telecomunicações", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.1" },
      { code: "3.1.03", name: "Material de Escritório", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.1" },
      { code: "3.1.04", name: "Honorários Contábeis", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.1" },
      { code: "3.1.05", name: "Honorários Jurídicos", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.1" },
      { code: "3.1.06", name: "Seguros", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.1" },
      { code: "3.2.01", name: "Folha Administrativa", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.2" },
      { code: "3.2.02", name: "Benefícios (VR, VT, Plano)", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.2" },
      { code: "3.2.03", name: "Treinamento e Capacitação", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.2" },
      { code: "3.3.01", name: "Marketing e Publicidade", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.3" },
      { code: "3.3.02", name: "Comissões Comerciais", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.3" },
      { code: "3.3.03", name: "Eventos e Networking", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.3" },
      { code: "3.4.01", name: "Juros e Multas", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.4" },
      { code: "3.4.02", name: "Tarifas Bancárias", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.4" },
      { code: "3.4.03", name: "IOF e Encargos", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.4" },
      { code: "3.5.01", name: "ISS", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.5" },
      { code: "3.5.02", name: "PIS/COFINS", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.5" },
      { code: "3.5.03", name: "IRPJ/CSLL", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.5" },
      { code: "3.5.04", name: "Simples Nacional (se aplicável)", type: "despesa", nature: "saida", accounting_class: "resultado", parentCode: "3.5" },
      { code: "4.1.01", name: "Equipamentos e TI", type: "investimento", nature: "saida", accounting_class: "ativo", parentCode: "4.1" },
      { code: "4.1.02", name: "Mobiliário", type: "investimento", nature: "saida", accounting_class: "ativo", parentCode: "4.1" },
      { code: "4.1.03", name: "Software e Licenças Permanentes", type: "investimento", nature: "saida", accounting_class: "ativo", parentCode: "4.1" },
      { code: "5.1.01", name: "Transferência Interna", type: "transferencia", nature: "neutro", accounting_class: "resultado", parentCode: "5.1" },
      { code: "5.1.02", name: "Aportes de Sócios", type: "transferencia", nature: "neutro", accounting_class: "resultado", parentCode: "5.1" },
      { code: "5.1.03", name: "Distribuição de Lucros", type: "transferencia", nature: "neutro", accounting_class: "resultado", parentCode: "5.1" },
    ];

    const { error: l3Err } = await supabase
      .from("chart_of_accounts" as any)
      .insert(level3.map(({ parentCode, ...a }) => ({ ...a, user_id: uid, organization_id: orgId, level: 3, is_synthetic: false, is_system_default: true, active: true, parent_id: l2Map[parentCode], description: null, tags: null })));
    if (l3Err) throw l3Err;

    qc.invalidateQueries({ queryKey: ["chart_of_accounts", orgId] });
    toast({ title: "Plano de contas padrão criado com sucesso" });
  };

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    toggleActive,
    remove,
    deleteAll,
    seedDefaultAccounts,
  };
}
