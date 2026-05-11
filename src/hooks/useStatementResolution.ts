import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface UnresolvedLine {
  id: string;
  bank_account_id: string;
  bank_account_nome: string | null;
  row_index: number;
  raw: Record<string, any>;
  parsed: Record<string, any>;
  errors: string[];
  status: "pendente" | "erro_validacao";
  created_at: string;
}

export interface CashflowLinkCandidate {
  cashflow_id: string;
  descricao: string;
  data_prevista: string | null;
  data_realizada: string | null;
  valor_previsto: number;
  valor_realizado: number | null;
  status: string;
  account_id: string | null;
  cost_center_id: string | null;
  match_score: number;
  ja_conciliado_com_id: string | null;
  ja_conciliado_com_descricao: string | null;
  ja_conciliado_com_data: string | null;
}

export function useStatementResolution() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  const { toast } = useToast();

  const unresolved = useQuery({
    queryKey: ["statement-staging-unresolved", currentOrg?.id],
    queryFn: async (): Promise<UnresolvedLine[]> => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase.rpc(
        "list_unresolved_statement_lines" as any,
        { p_org: currentOrg.id }
      );
      if (error) throw error;
      return (data ?? []) as UnresolvedLine[];
    },
    enabled: !!currentOrg?.id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["statement-staging-unresolved", currentOrg?.id] });
    qc.invalidateQueries({ queryKey: ["bank-statement-entries", currentOrg?.id] });
    qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
  };

  const searchCandidates = async (
    bankAccountId: string,
    data: string,
    valor: number,
    includeAlreadyReconciled: boolean
  ): Promise<CashflowLinkCandidate[]> => {
    if (!currentOrg?.id) return [];
    const { data: rows, error } = await supabase.rpc(
      "search_cashflow_for_link" as any,
      {
        p_org: currentOrg.id,
        p_bank_account: bankAccountId,
        p_data: data,
        p_valor: valor,
        p_include_already_reconciled: includeAlreadyReconciled,
        p_window_days: 30,
      }
    );
    if (error) throw error;
    return (rows ?? []) as CashflowLinkCandidate[];
  };

  const linkToCashflow = useMutation({
    mutationFn: async (input: { stagingId: string; cashflowId: string; force?: boolean }) => {
      const { data, error } = await supabase.rpc("resolve_link_to_cashflow" as any, {
        p_staging_id: input.stagingId,
        p_cashflow_entry_id: input.cashflowId,
        p_force_relink: !!input.force,
      });
      if (error) throw error;
      return data as { ok: boolean; previous_bank_statement_entry_id: string | null };
    },
    onSuccess: (r) => {
      invalidate();
      toast({
        title: "Vinculado ao previsto",
        description: r.previous_bank_statement_entry_id
          ? "Conciliação anterior substituída — a linha antiga voltou para 'pendente'."
          : "Lançamento previsto marcado como realizado.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Falha ao vincular", description: e.message, variant: "destructive" }),
  });

  const discard = useMutation({
    mutationFn: async (input: { stagingId: string; category: string; reason: string }) => {
      const { error } = await supabase.rpc("resolve_discard" as any, {
        p_staging_id: input.stagingId,
        p_category: input.category,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Linha descartada", description: "Registro mantido em auditoria." });
    },
    onError: (e: any) =>
      toast({ title: "Falha ao descartar", description: e.message, variant: "destructive" }),
  });

  const correctAndRetry = useMutation({
    mutationFn: async (input: {
      stagingId: string;
      data: string;
      valor: number;
      descricao: string;
      documento?: string | null;
    }) => {
      const { error } = await supabase.rpc("resolve_correct_and_retry" as any, {
        p_staging_id: input.stagingId,
        p_data: input.data,
        p_valor: input.valor,
        p_descricao: input.descricao,
        p_documento: input.documento ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Linha corrigida", description: "Lançamento adicionado ao extrato." });
    },
    onError: (e: any) =>
      toast({ title: "Falha ao corrigir", description: e.message, variant: "destructive" }),
  });

  return { unresolved, searchCandidates, linkToCashflow, discard, correctAndRetry };
}
