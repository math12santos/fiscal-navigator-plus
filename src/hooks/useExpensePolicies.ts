import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";

export interface ExpensePolicy {
  id: string;
  organization_id: string;
  source_module: "dp" | "juridico" | "ti" | "crm" | "financeiro" | "cadastros";
  subtype: "expense" | "reimbursement";
  title: string;
  description: string | null;
  max_value: number | null;
  requires_attachment: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Filters {
  sourceModule?: ExpensePolicy["source_module"];
  subtype?: ExpensePolicy["subtype"];
}

export function useExpensePolicies(filters?: Filters) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["expense_policies", orgId, filters],
    queryFn: async () => {
      let q = supabase
        .from("expense_policies" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (filters?.sourceModule) q = q.eq("source_module", filters.sourceModule);
      if (filters?.subtype) q = q.eq("subtype", filters.subtype);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ExpensePolicy[];
    },
    enabled: !!user && !!orgId,
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<ExpensePolicy>) => {
      const { data, error } = await supabase
        .from("expense_policies" as any)
        .insert({ ...input, organization_id: orgId, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExpensePolicy;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_policies"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ExpensePolicy> & { id: string }) => {
      const { data, error } = await supabase
        .from("expense_policies" as any)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExpensePolicy;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_policies"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_policies" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_policies"] }),
  });

  return { policies: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
