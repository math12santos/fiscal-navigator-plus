import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export type StatementStatus = "pendente" | "conciliado" | "divergente" | "ignorado";

export interface BankStatementEntry {
  id: string;
  organization_id: string;
  bank_account_id: string;
  data: string;
  descricao: string;
  valor: number;
  documento: string | null;
  notes: string | null;
  status: StatementStatus;
  cashflow_entry_id: string | null;
  reconciled_at: string | null;
  created_at: string;
  bank_accounts?: { nome: string; banco: string | null } | null;
}

export interface CashflowCandidate {
  cashflow_id: string;
  descricao: string;
  valor_previsto: number;
  valor_realizado: number | null;
  data_prevista: string;
  data_realizada: string | null;
  tipo: string;
  status: string;
  score: number;
}

interface ConciliacaoFilters {
  bankAccountId?: string;
  status?: StatementStatus | "all";
  from?: string;
  to?: string;
}

export function useConciliacao(filters: ConciliacaoFilters = {}) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const orgId = currentOrg?.id;

  const entries = useQuery({
    queryKey: ["bank-statement-entries", orgId, filters],
    queryFn: async () => {
      if (!orgId) return [];
      let q = supabase
        .from("bank_statement_entries")
        .select("*, bank_accounts(nome, banco)")
        .eq("organization_id", orgId)
        .order("data", { ascending: false })
        .limit(500);
      if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.from) q = q.gte("data", filters.from);
      if (filters.to) q = q.lte("data", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BankStatementEntry[];
    },
    enabled: !!orgId,
  });

  const stats = (() => {
    const list = entries.data || [];
    const total = list.length;
    const conciliados = list.filter((e) => e.status === "conciliado").length;
    const divergentes = list.filter((e) => e.status === "divergente").length;
    const pendentes = list.filter((e) => e.status === "pendente").length;
    const taxa = total > 0 ? (conciliados / total) * 100 : 0;
    return { total, conciliados, divergentes, pendentes, taxa };
  })();

  const fetchCandidates = async (statementId: string): Promise<CashflowCandidate[]> => {
    const { data, error } = await supabase.rpc("match_statement_to_cashflow", {
      p_statement_id: statementId,
    });
    if (error) throw error;
    return (data || []) as CashflowCandidate[];
  };

  const reconcile = useMutation({
    mutationFn: async ({ statementId, cashflowId }: { statementId: string; cashflowId: string }) => {
      const { error } = await supabase.rpc("reconcile_statement_entry", {
        p_statement_id: statementId,
        p_cashflow_id: cashflowId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statement-entries", orgId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] });
      toast({ title: "Conciliado", description: "Lançamento vinculado ao extrato." });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao conciliar", description: e.message, variant: "destructive" });
    },
  });

  const unreconcile = useMutation({
    mutationFn: async (statementId: string) => {
      const { error } = await supabase.rpc("unreconcile_statement_entry", {
        p_statement_id: statementId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statement-entries", orgId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] });
      toast({ title: "Conciliação desfeita" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ statementId, status }: { statementId: string; status: StatementStatus }) => {
      const { error } = await supabase
        .from("bank_statement_entries")
        .update({ status })
        .eq("id", statementId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statement-entries", orgId] });
    },
  });

  const removeEntry = useMutation({
    mutationFn: async (statementId: string) => {
      const { error } = await supabase
        .from("bank_statement_entries")
        .delete()
        .eq("id", statementId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statement-entries", orgId] });
      toast({ title: "Linha removida" });
    },
  });

  return {
    entries: entries.data || [],
    isLoading: entries.isLoading,
    stats,
    fetchCandidates,
    reconcile,
    unreconcile,
    updateStatus,
    removeEntry,
  };
}
