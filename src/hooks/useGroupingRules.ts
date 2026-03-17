import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SUB_CATEGORY_LABELS } from "@/hooks/usePayrollProjections";

export interface GroupingRule {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  match_field: string;
  match_value: string;
  sub_group_field: string | null;
  min_items: number;
  enabled: boolean;
  priority: number;
  group_id: string | null;
  operator: string;
  match_keyword: string | null;
  created_at: string;
  updated_at: string;
}

export type GroupingRuleInput = Omit<GroupingRule, "id" | "created_at" | "updated_at" | "organization_id" | "user_id">;

export const MATCH_FIELD_OPTIONS = [
  { value: "categoria", label: "Categoria" },
  { value: "source", label: "Fonte" },
  { value: "entity_id", label: "Fornecedor" },
  { value: "descricao", label: "Descrição" },
  { value: "cost_center_id", label: "Centro de Custo" },
  { value: "dp_sub_category", label: "Subcategoria DP" },
];

export const OPERATOR_OPTIONS = [
  { value: "equals", label: "É igual a" },
  { value: "contains", label: "Contém" },
  { value: "starts_with", label: "Começa com" },
  { value: "in_list", label: "Está na lista" },
];

export const SOURCE_OPTIONS = [
  { value: "dp", label: "Pessoal/DP" },
  { value: "contrato", label: "Contratos" },
  { value: "manual", label: "Manual" },
];

export const SUB_GROUP_FIELD_OPTIONS = [
  { value: "dp_sub_category", label: "Subcategoria DP" },
  { value: "entity_id", label: "Fornecedor/Entidade" },
];

/** Default rules used as fallback when no DB rules exist */
const DEFAULT_RULES: Omit<GroupingRule, "id" | "created_at" | "updated_at" | "organization_id" | "user_id">[] = [
  { name: "Folha", match_field: "dp_sub_category", match_value: "salario_liquido", sub_group_field: null, min_items: 1, enabled: true, priority: 25, group_id: null, operator: "equals", match_keyword: null },
  { name: "Encargos", match_field: "dp_sub_category", match_value: "encargos_fgts,encargos_inss,encargos_irrf", sub_group_field: null, min_items: 1, enabled: true, priority: 24, group_id: null, operator: "in_list", match_keyword: null },
  { name: "VT", match_field: "dp_sub_category", match_value: "vt", sub_group_field: null, min_items: 1, enabled: true, priority: 23, group_id: null, operator: "equals", match_keyword: null },
  { name: "Benefícios", match_field: "dp_sub_category", match_value: "beneficios", sub_group_field: null, min_items: 1, enabled: true, priority: 22, group_id: null, operator: "equals", match_keyword: null },
  { name: "Provisões", match_field: "dp_sub_category", match_value: "provisoes", sub_group_field: null, min_items: 1, enabled: true, priority: 21, group_id: null, operator: "equals", match_keyword: null },
  { name: "Contratos", match_field: "source", match_value: "contrato", sub_group_field: "entity_id", min_items: 2, enabled: true, priority: 5, group_id: null, operator: "equals", match_keyword: null },
];

/** Evaluate if a rule matches an entry */
function evaluateRule(rule: GroupingRule | typeof DEFAULT_RULES[0], entry: any): boolean {
  const op = rule.operator || "equals";
  const fieldValue = String(entry[rule.match_field] ?? "");
  const matchVal = rule.match_value ?? "";

  // Keyword match — comma-separated list means "any keyword matches"
  if (rule.match_keyword) {
    const fieldVal = fieldValue.toLowerCase();
    const keywords = rule.match_keyword.split(",").map(s => s.trim().toLowerCase());
    switch (op) {
      case "contains": return keywords.some(kw => fieldVal.includes(kw));
      case "starts_with": return keywords.some(kw => fieldVal.startsWith(kw));
      case "equals": return keywords.some(kw => fieldVal === kw);
      case "in_list": return keywords.includes(fieldVal);
      default: return false;
    }
  }

  switch (op) {
    case "equals": return fieldValue === matchVal;
    case "contains": return fieldValue.toLowerCase().includes(matchVal.toLowerCase());
    case "starts_with": return fieldValue.toLowerCase().startsWith(matchVal.toLowerCase());
    case "in_list": return matchVal.split(",").map(s => s.trim()).includes(fieldValue);
    default: return fieldValue === matchVal;
  }
}

export function useGroupingRules() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const queryKey = ["grouping_rules", orgId];

  const { data: rules = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grouping_rules" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data as any[]) as GroupingRule[];
    },
    enabled: !!orgId,
  });

  /** Active rules sorted by priority desc; falls back to defaults if empty */
  const activeRules = rules.length > 0
    ? rules.filter((r) => r.enabled)
    : DEFAULT_RULES.filter((r) => r.enabled) as GroupingRule[];

  /** Finds the matching rule for a given entry */
  const getMatchingRule = (entry: any): GroupingRule | null => {
    for (const rule of activeRules) {
      if (evaluateRule(rule, entry)) return rule as GroupingRule;
    }
    return null;
  };

  /** Returns the group label for an entry */
  const getGroupLabel = (entry: any): string => {
    const rule = getMatchingRule(entry);
    if (rule) return rule.name;
    return entry.categoria || entry.source || "Não Classificado";
  };

  /** Returns the sub-group key for an entry, or null if no sub-grouping */
  const getSubGroupKey = (entry: any): string | null => {
    const rule = getMatchingRule(entry);
    if (rule?.sub_group_field) return entry[rule.sub_group_field] ?? "other";
    return null;
  };

  /** Returns a human-readable label for a sub-group key */
  const getSubGroupLabel = (key: string, source: string, entries: any[]): string => {
    if (source === "dp") return SUB_CATEGORY_LABELS[key] ?? key;
    if (source === "contrato") return entries[0]?.descricao ?? key.slice(0, 12);
    return key;
  };

  /** Min items threshold for a given entry's rule */
  const getMinItems = (entry: any): number => {
    const rule = getMatchingRule(entry);
    return rule?.min_items ?? 2;
  };

  /** Checks if an entry should be groupable */
  const isGroupable = (entry: any): boolean => {
    return !!getMatchingRule(entry);
  };

  /** Returns the group_id for an entry (for macrogroup→group resolution) */
  const getGroupId = (entry: any): string | null => {
    const rule = getMatchingRule(entry);
    return rule?.group_id ?? null;
  };

  // CRUD mutations
  const create = useMutation({
    mutationFn: async (input: GroupingRuleInput) => {
      const { data, error } = await supabase
        .from("grouping_rules" as any)
        .insert({ ...input, organization_id: orgId!, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Regra criada com sucesso" });
    },
    onError: () => toast({ title: "Erro ao criar regra", variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: Partial<GroupingRuleInput> & { id: string }) => {
      const { error } = await supabase
        .from("grouping_rules" as any)
        .update(input)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Regra atualizada" });
    },
    onError: () => toast({ title: "Erro ao atualizar regra", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("grouping_rules" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Regra excluída" });
    },
    onError: () => toast({ title: "Erro ao excluir regra", variant: "destructive" }),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("grouping_rules" as any)
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const inserts = DEFAULT_RULES.map((r) => ({
        ...r,
        organization_id: orgId!,
        user_id: user!.id,
      }));
      const { error } = await supabase
        .from("grouping_rules" as any)
        .insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Regras padrão criadas" });
    },
  });

  return {
    rules,
    isLoading,
    activeRules,
    create,
    update,
    remove,
    toggleEnabled,
    seedDefaults,
    getGroupLabel,
    getSubGroupKey,
    getSubGroupLabel,
    getMinItems,
    isGroupable,
    getMatchingRule,
    getGroupId,
  };
}
