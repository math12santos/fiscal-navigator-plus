import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useContracts, Contract } from "@/hooks/useContracts";
import { useMemo } from "react";
import { addMonths, startOfMonth, endOfMonth, format, isBefore, isAfter } from "date-fns";

export interface CashFlowEntry {
  id: string;
  organization_id: string | null;
  user_id: string;
  contract_id: string | null;
  contract_installment_id: string | null;
  tipo: string;
  categoria: string | null;
  descricao: string;
  valor_previsto: number;
  valor_realizado: number | null;
  data_prevista: string;
  data_realizada: string | null;
  status: string;
  account_id: string | null;
  cost_center_id: string | null;
  entity_id: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export type CashFlowInput = Omit<CashFlowEntry, "id" | "created_at" | "updated_at" | "user_id" | "organization_id">;

/**
 * Generate projected cashflow entries from a contract's recurrence.
 * These are virtual entries (not persisted) for display purposes.
 */
function generateProjectionsFromContract(
  contract: Contract,
  rangeFrom: Date,
  rangeTo: Date
): Omit<CashFlowEntry, "user_id" | "organization_id">[] {
  const projections: Omit<CashFlowEntry, "user_id" | "organization_id">[] = [];

  if (contract.status !== "Ativo") return projections;
  if (contract.tipo_recorrencia === "unico") return projections; // handled by installments

  const contractStart = contract.data_inicio ? new Date(contract.data_inicio) : new Date(contract.created_at);
  const contractEnd = contract.data_fim ? new Date(contract.data_fim) : null;

  const recurrenceMonths: Record<string, number> = {
    mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
  };
  const interval = recurrenceMonths[contract.tipo_recorrencia] ?? 1;
  const dia = contract.dia_vencimento ?? 1;

  const tipo = contract.impacto_resultado === "receita" ? "entrada" : "saida";

  // Iterate from contract start, generating one entry per recurrence interval
  let current = new Date(contractStart.getFullYear(), contractStart.getMonth(), Math.min(dia, 28));

  // Go back to align with interval start
  while (isBefore(current, rangeFrom) && (!contractEnd || isBefore(current, contractEnd))) {
    current = addMonths(current, interval);
  }
  // Also go back to catch entries before rangeFrom that might still be in range
  let cursor = new Date(contractStart.getFullYear(), contractStart.getMonth(), Math.min(dia, 28));

  while (!isAfter(cursor, rangeTo)) {
    if (!isBefore(cursor, rangeFrom) && !isAfter(cursor, rangeTo)) {
      if (!contractEnd || !isAfter(cursor, contractEnd)) {
        projections.push({
          id: `proj-${contract.id}-${format(cursor, "yyyy-MM")}`,
          contract_id: contract.id,
          contract_installment_id: null,
          tipo,
          categoria: contract.natureza_financeira,
          descricao: `${contract.nome} — ${format(cursor, "MM/yyyy")}`,
          valor_previsto: Number(contract.valor),
          valor_realizado: null,
          data_prevista: format(cursor, "yyyy-MM-dd"),
          data_realizada: null,
          status: "previsto",
          account_id: null,
          cost_center_id: contract.cost_center_id,
          entity_id: contract.entity_id,
          notes: null,
          source: "contrato",
          created_at: contract.created_at,
          updated_at: contract.created_at,
        });
      }
    }
    cursor = addMonths(cursor, interval);
  }

  return projections;
}

export function useCashFlow(rangeFrom?: Date, rangeTo?: Date) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  // Materialized entries from DB
  const entriesQuery = useQuery({
    queryKey: ["cashflow_entries", orgId, rangeFrom?.toISOString(), rangeTo?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("cashflow_entries" as any)
        .select("*")
        .order("data_prevista", { ascending: true });
      if (orgId) q = q.eq("organization_id", orgId);
      if (rangeFrom) q = q.gte("data_prevista", format(rangeFrom, "yyyy-MM-dd"));
      if (rangeTo) q = q.lte("data_prevista", format(rangeTo, "yyyy-MM-dd"));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CashFlowEntry[];
    },
    enabled: !!user && !!orgId,
  });

  // Contract projections (virtual)
  const { contracts } = useContracts();

  const projectedEntries = useMemo(() => {
    if (!rangeFrom || !rangeTo || contracts.length === 0) return [];
    const materializedContractKeys = new Set(
      (entriesQuery.data ?? [])
        .filter((e) => e.contract_id && e.source === "contrato")
        .map((e) => `${e.contract_id}-${e.data_prevista?.substring(0, 7)}`)
    );

    return contracts.flatMap((c) => {
      const projections = generateProjectionsFromContract(c, rangeFrom, rangeTo);
      // Exclude projections already materialized
      return projections.filter(
        (p) => !materializedContractKeys.has(`${p.contract_id}-${p.data_prevista?.substring(0, 7)}`)
      );
    });
  }, [contracts, rangeFrom, rangeTo, entriesQuery.data]);

  // Merge materialized + projected
  const allEntries = useMemo(() => {
    const materialized = entriesQuery.data ?? [];
    const merged = [...materialized, ...projectedEntries as any[]];
    merged.sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    return merged as CashFlowEntry[];
  }, [entriesQuery.data, projectedEntries]);

  // KPIs
  const totals = useMemo(() => {
    let entradas = 0, saidas = 0;
    for (const e of allEntries) {
      const val = e.valor_realizado ?? e.valor_previsto;
      if (e.tipo === "entrada") entradas += Number(val);
      else saidas += Number(val);
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [allEntries]);

  // Mutations for materialized entries
  const create = useMutation({
    mutationFn: async (input: CashFlowInput) => {
      const { error } = await supabase.from("cashflow_entries" as any).insert({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashflow_entries", orgId] });
      toast({ title: "Lançamento criado" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CashFlowInput>) => {
      const { error } = await supabase.from("cashflow_entries" as any).update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashflow_entries", orgId] });
      toast({ title: "Lançamento atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  // Materialize a projected entry (confirm payment)
  const materialize = useMutation({
    mutationFn: async (entry: CashFlowEntry & { valor_realizado: number; data_realizada: string }) => {
      const { error } = await supabase.from("cashflow_entries" as any).insert({
        contract_id: entry.contract_id,
        contract_installment_id: entry.contract_installment_id,
        tipo: entry.tipo,
        categoria: entry.categoria,
        descricao: entry.descricao,
        valor_previsto: entry.valor_previsto,
        valor_realizado: entry.valor_realizado,
        data_prevista: entry.data_prevista,
        data_realizada: entry.data_realizada,
        status: "pago",
        account_id: entry.account_id,
        cost_center_id: entry.cost_center_id,
        entity_id: entry.entity_id,
        notes: entry.notes,
        source: "contrato",
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashflow_entries", orgId] });
      toast({ title: "Pagamento confirmado" });
    },
    onError: (e: any) => toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cashflow_entries" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashflow_entries", orgId] });
      toast({ title: "Lançamento removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return {
    entries: allEntries,
    materializedEntries: entriesQuery.data ?? [],
    projectedEntries,
    totals,
    isLoading: entriesQuery.isLoading,
    create,
    update,
    materialize,
    remove,
  };
}
