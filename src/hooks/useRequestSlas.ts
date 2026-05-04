import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";

export interface RequestSla {
  id: string;
  organization_id: string;
  source_module: "dp" | "juridico" | "ti" | "crm" | "financeiro" | "cadastros";
  subtype: "expense" | "reimbursement";
  priority: "baixa" | "media" | "alta" | "urgente";
  sla_hours: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Filters {
  sourceModule?: RequestSla["source_module"];
  subtype?: RequestSla["subtype"];
}

export function useRequestSlas(filters?: Filters) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["request_slas", orgId, filters],
    queryFn: async () => {
      let q = supabase
        .from("request_slas" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .eq("active", true);
      if (filters?.sourceModule) q = q.eq("source_module", filters.sourceModule);
      if (filters?.subtype) q = q.eq("subtype", filters.subtype);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RequestSla[];
    },
    enabled: !!user && !!orgId,
    staleTime: 5 * 60_000,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<RequestSla> & { id?: string }) => {
      const payload = { ...input, organization_id: orgId };
      if (input.id) {
        const { data, error } = await supabase
          .from("request_slas" as any)
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("request_slas" as any)
        .upsert(payload, { onConflict: "organization_id,source_module,subtype,priority" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["request_slas"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("request_slas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["request_slas"] }),
  });

  return { slas: query.data ?? [], isLoading: query.isLoading, upsert, remove };
}
