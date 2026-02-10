import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface BudgetVersion {
  id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetLine {
  id: string;
  budget_version_id: string;
  organization_id: string | null;
  user_id: string;
  account_id: string | null;
  cost_center_id: string | null;
  month: string;
  tipo: string;
  natureza: string;
  valor_orcado: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BudgetVersionInput = Omit<BudgetVersion, "id" | "user_id" | "organization_id" | "created_at" | "updated_at">;
export type BudgetLineInput = Omit<BudgetLine, "id" | "user_id" | "organization_id" | "created_at" | "updated_at">;

export function useBudget() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const versionsQuery = useQuery({
    queryKey: ["budget_versions", orgId],
    queryFn: async () => {
      let q = supabase
        .from("budget_versions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (orgId) q = q.eq("organization_id", orgId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BudgetVersion[];
    },
    enabled: !!user && !!orgId,
  });

  // Removed: linesQuery was a hook-returning function (violates Rules of Hooks).
  // Use the standalone useBudgetLines hook instead.

  const createVersion = useMutation({
    mutationFn: async (input: BudgetVersionInput) => {
      const { data, error } = await supabase
        .from("budget_versions" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BudgetVersion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_versions", orgId] });
      toast({ title: "Versão de orçamento criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateVersion = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<BudgetVersionInput>) => {
      const { error } = await supabase
        .from("budget_versions" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_versions", orgId] });
      toast({ title: "Versão atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteVersion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_versions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_versions", orgId] });
      toast({ title: "Versão removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const upsertLines = useMutation({
    mutationFn: async (lines: BudgetLineInput[]) => {
      const payload = lines.map((l) => ({
        ...l,
        user_id: user!.id,
        organization_id: orgId,
      }));
      const { error } = await supabase
        .from("budget_lines" as any)
        .upsert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_lines", orgId] });
      toast({ title: "Orçamento salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const createLine = useMutation({
    mutationFn: async (input: BudgetLineInput) => {
      const { data, error } = await supabase
        .from("budget_lines" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BudgetLine;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["budget_lines", orgId, vars.budget_version_id] });
      toast({ title: "Linha adicionada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateLine = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<BudgetLineInput>) => {
      const { error } = await supabase
        .from("budget_lines" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_lines", orgId] });
      toast({ title: "Linha atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_lines" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_lines", orgId] });
      toast({ title: "Linha removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoadingVersions: versionsQuery.isLoading,
    createVersion,
    updateVersion,
    deleteVersion,
    createLine,
    updateLine,
    deleteLine,
    upsertLines,
  };
}

/** Standalone hook for budget lines — safe to call at top level */
export function useBudgetLines(versionId: string | null) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ["budget_lines", orgId, versionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_lines" as any)
        .select("*")
        .eq("budget_version_id", versionId!)
        .order("month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BudgetLine[];
    },
    enabled: !!user && !!orgId && !!versionId,
  });
}
