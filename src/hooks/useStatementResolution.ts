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

export interface TransferCounterparty {
  staging_id: string;
  bank_account_id: string;
  bank_account_nome: string | null;
  data: string;
  valor: number;
  descricao: string | null;
  status: string;
  match_score: number;
}

export interface ReversalCandidate {
  cashflow_id: string;
  descricao: string;
  data_realizada: string | null;
  valor_realizado: number | null;
  tipo: string;
  conta_bancaria_id: string | null;
  match_score: number;
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
    qc.invalidateQueries({ queryKey: ["financeiro_entries"] });
    qc.invalidateQueries({ queryKey: ["internal_transfers"] });
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

  const searchTransferCounterparties = async (
    stagingId: string,
    windowDays = 3
  ): Promise<TransferCounterparty[]> => {
    const { data, error } = await supabase.rpc("search_transfer_counterparties" as any, {
      p_staging_id: stagingId,
      p_window_days: windowDays,
    });
    if (error) throw error;
    return (data ?? []) as TransferCounterparty[];
  };

  const searchReversalCandidates = async (
    stagingId: string,
    windowDays = 90
  ): Promise<ReversalCandidate[]> => {
    const { data, error } = await supabase.rpc("search_reversal_candidates" as any, {
      p_staging_id: stagingId,
      p_window_days: windowDays,
    });
    if (error) throw error;
    return (data ?? []) as ReversalCandidate[];
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
      toast({ title: "Dados complementados", description: "Linha pronta para resolução." });
    },
    onError: (e: any) =>
      toast({ title: "Falha ao corrigir", description: e.message, variant: "destructive" }),
  });

  const createFromStatement = useMutation({
    mutationFn: async (input: {
      stagingId: string;
      descricao: string;
      account_id?: string | null;
      cost_center_id?: string | null;
      entity_id?: string | null;
      contract_id?: string | null;
      categoria?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("resolve_create_cashflow" as any, {
        p_staging_id: input.stagingId,
        p_descricao: input.descricao,
        p_account_id: input.account_id ?? null,
        p_cost_center_id: input.cost_center_id ?? null,
        p_entity_id: input.entity_id ?? null,
        p_contract_id: input.contract_id ?? null,
        p_categoria: input.categoria ?? null,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Lançamento criado",
        description: "Movimentação cadastrada e marcada como realizada.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Falha ao criar lançamento", description: e.message, variant: "destructive" }),
  });

  const markAsTransfer = useMutation({
    mutationFn: async (input: {
      stagingId: string;
      counterpartyStagingId?: string | null;
      descricao?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("resolve_mark_as_transfer" as any, {
        p_staging_id: input.stagingId,
        p_counterparty_staging_id: input.counterpartyStagingId ?? null,
        p_descricao: input.descricao ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; transfer_id: string; status: string };
    },
    onSuccess: (r) => {
      invalidate();
      toast({
        title: "Transferência registrada",
        description: r.status === "completa"
          ? "Os dois lados foram pareados."
          : "Aguardando contraparte aparecer no extrato da outra conta.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Falha ao marcar transferência", description: e.message, variant: "destructive" }),
  });

  const markAsReversal = useMutation({
    mutationFn: async (input: { stagingId: string; originalEntryId: string; notes?: string | null }) => {
      const { data, error } = await supabase.rpc("resolve_mark_as_reversal" as any, {
        p_staging_id: input.stagingId,
        p_original_entry_id: input.originalEntryId,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Estorno registrado",
        description: "Lançamento original anulado, sem duplicidade.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Falha ao registrar estorno", description: e.message, variant: "destructive" }),
  });

  return {
    unresolved,
    searchCandidates,
    searchTransferCounterparties,
    searchReversalCandidates,
    linkToCashflow,
    discard,
    correctAndRetry,
    createFromStatement,
    markAsTransfer,
    markAsReversal,
  };
}
