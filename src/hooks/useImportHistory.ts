import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export function useImportHistory() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const orgId = currentOrg?.id;

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["data-imports", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_imports")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const revertImport = useMutation({
    mutationFn: async (importId: string) => {
      // Delete all cashflow_entries linked to this import
      const { error: delErr } = await supabase
        .from("cashflow_entries")
        .delete()
        .eq("import_id", importId);
      if (delErr) throw delErr;

      // Mark import as reverted
      const { error: updErr } = await supabase
        .from("data_imports")
        .update({ status: "reverted" })
        .eq("id", importId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-imports"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] });
      toast({ title: "Importação revertida", description: "Todos os lançamentos vinculados foram removidos." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao reverter", description: err.message, variant: "destructive" });
    },
  });

  return { imports, isLoading, revertImport };
}
