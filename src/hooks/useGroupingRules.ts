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
  created_at: string;
  updated_at: string;
}

export type GroupingRuleInput = Omit<GroupingRule, "id" | "created_at" | "updated_at" | "organization_id" | "user_id">;

const MATCH_FIELD_LABELS: Record<string, string> = {
  categoria: "Categoria",
  source: "Fonte",
  entity_id: "Fornecedor",
};

const SUB_GROUP_FIELD_LABELS: Record<string, string> = {
  dp_sub_category: "Subcategoria DP",
  entity_id: "Fornecedor/Entidade",
};

export const MATCH_FIELD_OPTIONS = Object.entries(MATCH_FIELD_LABELS).map(([value, label]) => ({ value, label }));
export const SUB_GROUP_FIELD_OPTIONS = Object.entries(SUB_GROUP_FIELD_LABELS).map(([value, label]) => ({ value, label }));

/** Default rules used as fallback when no DB rules exist */
const DEFAULT_RULES: Omit<GroupingRule, "id" | "created_at" | "updated_at" | "organization_id" | "user_id">[] = [
  { name: "Pessoal", match_field: "source", match_value: "dp", sub_group_field: "dp_sub_category", min_items: 2, enabled: true, priority: 10 },
  { name: "Contratos", match_field: "source", match_value: "contrato", sub_group_field: "entity_id", min_items: 2, enabled: true, priority: 5 },
];

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
      const fieldValue = entry[rule.match_field];
      if (fieldValue === rule.match_value) return rule;
    }
    return null;
  };

  /** Returns the group label for an entry */
  const getGroupLabel = (entry: any): string => {
    const rule = getMatchingRule(entry);
    if (rule) return rule.name;
    return entry.categoria || entry.source || "Outros";
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

  /** Checks if an entry should be groupable (matches any active rule OR fallback) */
  const isGroupable = (entry: any): boolean => {
    return !!getMatchingRule(entry);
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
    // Matcher functions for consumers
    getGroupLabel,
    getSubGroupKey,
    getSubGroupLabel,
    getMinItems,
    isGroupable,
    getMatchingRule,
  };
}
