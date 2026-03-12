import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface GroupingMacrogroup {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  order_index: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupingGroup {
  id: string;
  macrogroup_id: string;
  organization_id: string;
  user_id: string;
  name: string;
  order_index: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type MacrogroupInput = Pick<GroupingMacrogroup, "name" | "icon" | "color" | "order_index" | "enabled">;
export type GroupInput = Pick<GroupingGroup, "macrogroup_id" | "name" | "order_index" | "enabled">;

const DEFAULT_SEED: { name: string; icon: string; color: string; groups: string[] }[] = [
  { name: "Pessoal e RH", icon: "Users", color: "#6366f1", groups: ["Folha", "Pró-labore", "Encargos", "Benefícios", "VT", "Férias", "13º Salário", "Rescisões", "RPA"] },
  { name: "Infraestrutura", icon: "Building2", color: "#8b5cf6", groups: ["Aluguel", "Condomínio", "Água", "Energia", "Internet", "Telefonia", "Limpeza", "Produtos de Limpeza"] },
  { name: "Tecnologia e Sistemas", icon: "Monitor", color: "#06b6d4", groups: ["Software/SaaS", "Hospedagem/Cloud", "Suporte TI", "Equipamentos"] },
  { name: "Fornecedores Operacionais", icon: "Truck", color: "#f59e0b", groups: ["Materiais", "Logística", "Suprimentos"] },
  { name: "Serviços Profissionais", icon: "Briefcase", color: "#10b981", groups: ["Contabilidade", "Jurídico", "Consultoria", "Auditoria"] },
  { name: "Tributário", icon: "Receipt", color: "#ef4444", groups: ["Impostos Federais", "Impostos Estaduais", "Impostos Municipais", "Parcelamentos"] },
  { name: "Financeiro", icon: "Landmark", color: "#3b82f6", groups: ["Juros", "Tarifas Bancárias", "IOF", "Seguros"] },
  { name: "Contratos", icon: "FileText", color: "#a855f7", groups: ["Contratos Recorrentes", "Contratos Pontuais"] },
  { name: "Patrimonial / Investimentos", icon: "TrendingUp", color: "#14b8a6", groups: ["Investimentos", "Amortização", "Depreciação"] },
  { name: "Despesas Eventuais", icon: "Zap", color: "#f97316", groups: ["Viagens", "Eventos", "Marketing", "Outros"] },
];

export function useGroupingMacrogroups() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const macrogroupsKey = ["grouping_macrogroups", orgId];
  const groupsKey = ["grouping_groups", orgId];

  // ── Macrogroups ──
  const { data: macrogroups = [], isLoading: loadingMacrogroups } = useQuery({
    queryKey: macrogroupsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grouping_macrogroups" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data as any[]) as GroupingMacrogroup[];
    },
    enabled: !!orgId,
  });

  // ── Groups ──
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: groupsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grouping_groups" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data as any[]) as GroupingGroup[];
    },
    enabled: !!orgId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: macrogroupsKey });
    qc.invalidateQueries({ queryKey: groupsKey });
  };

  // ── Macrogroup CRUD ──
  const createMacrogroup = useMutation({
    mutationFn: async (input: MacrogroupInput) => {
      const { data, error } = await supabase
        .from("grouping_macrogroups" as any)
        .insert({ ...input, organization_id: orgId!, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Macrogrupo criado" }); },
    onError: () => toast({ title: "Erro ao criar macrogrupo", variant: "destructive" }),
  });

  const updateMacrogroup = useMutation({
    mutationFn: async ({ id, ...input }: Partial<MacrogroupInput> & { id: string }) => {
      const { error } = await supabase
        .from("grouping_macrogroups" as any)
        .update(input)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Macrogrupo atualizado" }); },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMacrogroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("grouping_macrogroups" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Macrogrupo excluído" }); },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const toggleMacrogroup = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("grouping_macrogroups" as any)
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  // ── Group CRUD ──
  const createGroup = useMutation({
    mutationFn: async (input: GroupInput) => {
      const { data, error } = await supabase
        .from("grouping_groups" as any)
        .insert({ ...input, organization_id: orgId!, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Grupo criado" }); },
    onError: () => toast({ title: "Erro ao criar grupo", variant: "destructive" }),
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...input }: Partial<GroupInput> & { id: string }) => {
      const { error } = await supabase
        .from("grouping_groups" as any)
        .update(input)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Grupo atualizado" }); },
    onError: () => toast({ title: "Erro ao atualizar grupo", variant: "destructive" }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("grouping_groups" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Grupo excluído" }); },
    onError: () => toast({ title: "Erro ao excluir grupo", variant: "destructive" }),
  });

  const toggleGroup = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("grouping_groups" as any)
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  // ── Seed defaults ──
  const seedDefaults = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < DEFAULT_SEED.length; i++) {
        const s = DEFAULT_SEED[i];
        const { data: mg, error: mgErr } = await supabase
          .from("grouping_macrogroups" as any)
          .insert({
            organization_id: orgId!,
            user_id: user!.id,
            name: s.name,
            icon: s.icon,
            color: s.color,
            order_index: i,
            enabled: true,
          })
          .select()
          .single();
        if (mgErr) throw mgErr;

        const groupInserts = s.groups.map((g, j) => ({
          macrogroup_id: (mg as any).id,
          organization_id: orgId!,
          user_id: user!.id,
          name: g,
          order_index: j,
          enabled: true,
        }));
        const { error: gErr } = await supabase
          .from("grouping_groups" as any)
          .insert(groupInserts);
        if (gErr) throw gErr;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Macrogrupos padrão criados com sucesso" });
    },
    onError: () => toast({ title: "Erro ao gerar padrão", variant: "destructive" }),
  });

  /** Get groups for a specific macrogroup */
  const getGroupsForMacrogroup = (macrogroupId: string) =>
    groups.filter((g) => g.macrogroup_id === macrogroupId);

  /** Get all groups as select options */
  const groupOptions = useMemo(() => {
    return groups.map((g) => {
      const mg = macrogroups.find((m) => m.id === g.macrogroup_id);
      return {
        value: g.id,
        label: mg ? `${mg.name} → ${g.name}` : g.name,
      };
    });
  }, [groups, macrogroups]);

  return {
    macrogroups,
    groups,
    loadingMacrogroups,
    loadingGroups,
    isLoading: loadingMacrogroups || loadingGroups,
    groupOptions,
    getGroupsForMacrogroup,
    createMacrogroup,
    updateMacrogroup,
    deleteMacrogroup,
    toggleMacrogroup,
    createGroup,
    updateGroup,
    deleteGroup,
    toggleGroup,
    seedDefaults,
  };
}

