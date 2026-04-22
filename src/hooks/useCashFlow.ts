import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useContracts, Contract } from "@/hooks/useContracts";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";
import { useUserDataScope } from "@/hooks/useUserDataScope";
import { useHolding } from "@/contexts/HoldingContext";
import { useMemo } from "react";
import { format, isBefore, isAfter } from "date-fns";
import { isRecurringCashflow, generateProjectionsFromContract } from "@/lib/contractProjections";
import { projectionKey, buildMaterializedRefs } from "@/lib/projectionRegistry";

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
  /** Canonical projection key — see src/lib/projectionRegistry.ts. Null for purely manual entries. */
  source_ref?: string | null;
  created_at: string;
  updated_at: string;
}

export type CashFlowInput = Omit<CashFlowEntry, "id" | "created_at" | "updated_at" | "user_id" | "organization_id">;


export function useCashFlow(rangeFrom?: Date, rangeTo?: Date) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  // Holding mode support
  const { holdingMode, activeOrgIds } = useHolding();

  // Materialized entries from DB
  const entriesQuery = useQuery({
    queryKey: ["cashflow_entries", holdingMode ? activeOrgIds : orgId, rangeFrom?.toISOString(), rangeTo?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("cashflow_entries" as any)
        .select("*")
        .order("data_prevista", { ascending: true });
      if (holdingMode && activeOrgIds.length > 0) {
        q = q.in("organization_id", activeOrgIds);
      } else if (orgId) {
        q = q.eq("organization_id", orgId);
      }
      if (rangeFrom) q = q.gte("data_prevista", format(rangeFrom, "yyyy-MM-dd"));
      if (rangeTo) q = q.lte("data_prevista", format(rangeTo, "yyyy-MM-dd"));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CashFlowEntry[];
    },
    enabled: !!user && !!orgId,
  });

  // Contract projections (virtual) — recurrent contracts
  const { contracts } = useContracts();

  // Installments for all non-recurring contracts (merchandise, assets, one-off services, etc.)
  const nonRecurringContractIds = useMemo(
    () => contracts.filter((c) => c.status === "Ativo" && !isRecurringCashflow(c)).map((c) => c.id),
    [contracts]
  );

  const installmentsQuery = useQuery({
    queryKey: ["cashflow_installments", orgId, nonRecurringContractIds],
    queryFn: async () => {
      if (nonRecurringContractIds.length === 0) return [];
      const { data, error } = await supabase
        .from("contract_installments" as any)
        .select("*")
        .in("contract_id", nonRecurringContractIds)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as import("@/hooks/useContractInstallments").ContractInstallment[];
    },
    enabled: !!user && !!orgId && nonRecurringContractIds.length > 0,
  });

  const projectedEntries = useMemo(() => {
    if (!rangeFrom || !rangeTo) return [];

    // Single source of truth: source_ref of every materialized entry.
    const materializedRefs = buildMaterializedRefs(entriesQuery.data ?? []);

    // 1. Recurrent contract projections (truly recurring services only)
    const recurrentProjections = contracts.flatMap((c) => {
      const projections = generateProjectionsFromContract(c, rangeFrom, rangeTo);
      return projections.filter((p) => {
        const ref = (p as any).source_ref ?? projectionKey.contract(c.id, p.data_prevista);
        return !materializedRefs.has(ref);
      });
    });

    // 2. Installment projections (non-recurring contracts with manual installments)
    const contractMap = new Map(contracts.map((c) => [c.id, c]));
    const installmentData = installmentsQuery.data ?? [];
    const contractsWithInstallments = new Set(installmentData.map((i) => i.contract_id));

    const installmentProjections = installmentData
      .filter((inst) => {
        const d = new Date(inst.data_vencimento);
        if (isBefore(d, rangeFrom) || isAfter(d, rangeTo)) return false;
        const ref = projectionKey.installment(inst.id, inst.contract_id, inst.data_vencimento);
        return !materializedRefs.has(ref);
      })
      .map((inst) => {
        const contract = contractMap.get(inst.contract_id);
        const tipo = contract?.impacto_resultado === "receita" ? "entrada" : "saida";
        return {
          id: `proj-inst-${inst.id}`,
          contract_id: inst.contract_id,
          contract_installment_id: inst.id,
          tipo,
          categoria: contract?.natureza_financeira ?? null,
          descricao: `${contract?.nome ?? "Contrato"} — ${inst.descricao}`,
          valor_previsto: Number(inst.valor),
          valor_realizado: (inst.status === "pago" || inst.status === "recebido") ? Number(inst.valor) : null,
          data_prevista: inst.data_vencimento,
          data_realizada: null,
          status: (inst.status === "pago" || inst.status === "recebido") ? "pago" : "previsto",
          account_id: null,
          cost_center_id: contract?.cost_center_id ?? null,
          entity_id: contract?.entity_id ?? null,
          notes: null,
          source: "contrato",
          source_ref: projectionKey.installment(inst.id, inst.contract_id, inst.data_vencimento),
          created_at: inst.created_at,
          updated_at: inst.created_at,
        } as Omit<CashFlowEntry, "user_id" | "organization_id">;
      });

    // 3. Single-entry fallback for non-recurring contracts WITHOUT installments
    const singleEntryProjections = contracts
      .filter((c) => c.status === "Ativo" && !isRecurringCashflow(c) && c.tipo_recorrencia !== "unico" && !contractsWithInstallments.has(c.id))
      .flatMap((c) => {
        const dateStr = c.data_inicio ?? format(new Date(c.created_at), "yyyy-MM-dd");
        const d = new Date(dateStr);
        if (isBefore(d, rangeFrom) || isAfter(d, rangeTo)) return [];
        const ref = projectionKey.contract(c.id, dateStr);
        if (materializedRefs.has(ref)) return [];
        const tipo = c.impacto_resultado === "receita" ? "entrada" : "saida";
        return [{
          id: `proj-single-${c.id}`,
          contract_id: c.id,
          contract_installment_id: null,
          tipo,
          categoria: c.natureza_financeira,
          descricao: `${c.nome} — entrada única`,
          valor_previsto: Number(c.valor),
          valor_realizado: null,
          data_prevista: dateStr,
          data_realizada: null,
          status: "previsto" as const,
          account_id: null,
          cost_center_id: c.cost_center_id,
          entity_id: c.entity_id,
          notes: null,
          source: "contrato",
          source_ref: ref,
          created_at: c.created_at,
          updated_at: c.created_at,
        } as Omit<CashFlowEntry, "user_id" | "organization_id">];
      });

    return [...recurrentProjections, ...installmentProjections, ...singleEntryProjections];
  }, [contracts, rangeFrom, rangeTo, entriesQuery.data, installmentsQuery.data]);

  // Payroll projections from DP
  const { payrollProjections } = usePayrollProjections(rangeFrom, rangeTo);

  // CRM opportunity projections (high-probability)
  const crmProjections = useMemo(() => {
    if (!rangeFrom || !rangeTo) return [];
    // Import lazily to avoid circular deps — we just access the query cache
    // We'll use opportunities passed from a parent or fetched here
    return [] as CashFlowEntry[]; // CRM projections are handled via useFinancialSummary for now
  }, [rangeFrom, rangeTo]);

  // Scope filter
  const { filterByScope } = useUserDataScope();

  // Merge materialized + projected + payroll, applying registry-based dedup.
  const allEntries = useMemo(() => {
    const materialized = entriesQuery.data ?? [];
    const materializedRefs = buildMaterializedRefs(materialized);

    // Dedup payroll projections against materialized DP entries by source_ref.
    const payrollDeduped = (payrollProjections as any[]).filter((p) => {
      const ref = p.source_ref;
      return !ref || !materializedRefs.has(ref);
    });

    const merged = [...materialized, ...projectedEntries as any[], ...payrollDeduped, ...crmProjections];
    merged.sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    return filterByScope(merged as CashFlowEntry[]);
  }, [entriesQuery.data, projectedEntries, payrollProjections, crmProjections, filterByScope]);

  // KPIs (consolidated across realized + projected, no double counting).
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
