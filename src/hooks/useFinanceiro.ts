import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useHolding } from "@/contexts/HoldingContext";
import { useUserDataScope } from "@/hooks/useUserDataScope";
import { useContracts, Contract } from "@/hooks/useContracts";
import { format, addMonths, startOfMonth } from "date-fns";
import type { CashFlowEntry } from "@/hooks/useCashFlow";
import { isRecurringCashflow, generateProjectionsFromContract } from "@/lib/contractProjections";
import { usePayrollProjections } from "@/hooks/usePayrollProjections";
import { projectionKey, extractSourceRef } from "@/lib/projectionRegistry";

export interface FinanceiroEntry extends CashFlowEntry {}

export interface FinanceiroInput {
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
  contract_id: string | null;
  contract_installment_id: string | null;
  // New fields
  documento: string | null;
  tipo_documento: string | null;
  tipo_despesa: string | null;
  subcategoria_id: string | null;
  valor_bruto: number;
  valor_desconto: number;
  valor_juros_multa: number;
  competencia: string | null;
  data_vencimento: string | null;
  data_prevista_pagamento: string | null;
  natureza_contabil: string | null;
  impacto_fluxo_caixa: boolean;
  impacto_orcamento: boolean;
  afeta_caixa_no_vencimento: boolean;
  conta_contabil_ref: string | null;
  forma_pagamento: string | null;
  conta_bancaria_id: string | null;
  num_parcelas: number | null;
  recorrencia: string | null;
  conciliacao_id: string | null;
}

/**
 * Hook for the Financeiro module — AP/AR management.
 * Fetches ALL cashflow_entries (no date filter) + contract installment projections.
 * Provides create/update/remove mutations and pay/receive actions.
 */
export function useFinanceiro(tipo: "saida" | "entrada") {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;
  const { holdingMode, activeOrgIds } = useHolding();
  const { filterByScope } = useUserDataScope();

  // All materialized entries of this type
  const entriesQuery = useQuery({
    queryKey: ["financeiro_entries", tipo, holdingMode ? activeOrgIds : orgId],
    queryFn: async () => {
      let q = supabase
        .from("cashflow_entries" as any)
        .select("*")
        .eq("tipo", tipo)
        .order("data_prevista", { ascending: true });
      if (holdingMode && activeOrgIds.length > 0) {
        q = q.in("organization_id", activeOrgIds);
      } else if (orgId) {
        q = q.eq("organization_id", orgId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FinanceiroEntry[];
    },
    enabled: !!user && !!orgId,
  });

  // Contract installment projections (not yet materialized)
  const { contracts } = useContracts();

  const installmentsQuery = useQuery({
    queryKey: ["financeiro_installments", tipo, orgId],
    queryFn: async () => {
      const relevantContracts = contracts.filter((c) => {
        const isTipo = tipo === "entrada"
          ? c.impacto_resultado === "receita"
          : c.impacto_resultado !== "receita";
        return c.status === "Ativo" && isTipo;
      });
      if (relevantContracts.length === 0) return [];
      const ids = relevantContracts.map((c) => c.id);
      const { data, error } = await supabase
        .from("contract_installments" as any)
        .select("*")
        .in("contract_id", ids)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as any[];
    },
    enabled: !!user && !!orgId && contracts.length > 0,
  });

  // Payroll projections (only for saida)
  const now = new Date();
  const rangeFrom = now;
  const rangeTo = addMonths(now, 12);
  const { payrollProjections } = usePayrollProjections(
    tipo === "saida" ? rangeFrom : undefined,
    tipo === "saida" ? rangeTo : undefined
  );

  // Merge materialized + projected installments + payroll
  const allEntries = useMemo(() => {
    const materialized = entriesQuery.data ?? [];
    const materializedInstKeys = new Set(
      materialized
        .filter((e) => e.contract_installment_id)
        .map((e) => e.contract_installment_id)
    );
    const materializedContractDateKeys = new Set(
      materialized
        .filter((e) => e.contract_id && e.source === "contrato")
        .map((e) => `${e.contract_id}-${e.data_prevista}`)
    );
    // De-dup payroll: check materialized DP entries by month
    const materializedDPMonths = new Set(
      materialized
        .filter((e) => e.source === "dp")
        .map((e) => format(new Date(e.data_prevista), "yyyy-MM"))
    );

    const contractMap = new Map(contracts.map((c) => [c.id, c]));

    // 1. Manual installment projections (non-materialized)
    const installments = (installmentsQuery.data ?? [])
      .filter((inst: any) => !materializedInstKeys.has(inst.id))
      .map((inst: any) => {
        const contract = contractMap.get(inst.contract_id);
        return {
          id: `proj-fin-${inst.id}`,
          contract_id: inst.contract_id,
          contract_installment_id: inst.id,
          tipo,
          categoria: contract?.natureza_financeira ?? null,
          descricao: `${contract?.nome ?? "Contrato"} — ${inst.descricao}`,
          valor_previsto: Number(inst.valor),
          valor_realizado: (inst.status === "pago" || inst.status === "recebido") ? Number(inst.valor) : null,
          data_prevista: inst.data_vencimento,
          data_realizada: null,
          status: (inst.status === "pago" || inst.status === "recebido") ? (tipo === "entrada" ? "recebido" : "pago") : "previsto",
          account_id: null,
          cost_center_id: contract?.cost_center_id ?? null,
          entity_id: contract?.entity_id ?? null,
          notes: null,
          source: "contrato",
          created_at: inst.created_at,
          updated_at: inst.created_at,
          organization_id: contract?.organization_id ?? orgId,
          user_id: inst.user_id,
        } as FinanceiroEntry;
      });

    // 2. Recurring contract projections (today → +12 months)
    const recurringProjections = contracts
      .filter((c) => {
        const isTipo = tipo === "entrada"
          ? c.impacto_resultado === "receita"
          : c.impacto_resultado !== "receita";
        return c.status === "Ativo" && isTipo && isRecurringCashflow(c);
      })
      .flatMap((c) => {
        const projections = generateProjectionsFromContract(c, rangeFrom, rangeTo);
        return projections
          .filter((p) => !materializedContractDateKeys.has(`${p.contract_id}-${p.data_prevista}`))
          .map((p) => ({
            ...p,
            organization_id: c.organization_id ?? orgId,
            user_id: user?.id ?? "",
          } as FinanceiroEntry));
      });

    // 3. Payroll projections (de-duped against materialized DP entries)
    const dpProjections = tipo === "saida"
      ? (payrollProjections as FinanceiroEntry[]).filter((p) => {
          const month = format(new Date(p.data_prevista), "yyyy-MM");
          return !materializedDPMonths.has(month);
        })
      : [];

    const merged = [...materialized, ...installments, ...recurringProjections, ...dpProjections];
    merged.sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    return filterByScope(merged);
  }, [entriesQuery.data, installmentsQuery.data, contracts, tipo, orgId, filterByScope, payrollProjections]);

  // Totais — MECE: cada lançamento conta em exatamente UM bucket (pendente OU realizado).
  // Provisões acumuladas (passivo trabalhista) NÃO entram no caixa.
  const totals = useMemo(() => {
    let total_previsto = 0;     // soma de TUDO (referência), sem dupla contagem entre buckets
    let total_realizado = 0;    // só pago/recebido (valor efetivamente movimentado)
    let pendente = 0;           // só previsto/confirmado (a vencer ou em aberto)
    let count_pendente = 0;

    for (const e of allEntries) {
      if ((e as any).dp_sub_category === "provisao_acumulada") continue;
      const isRealized = e.status === "pago" || e.status === "recebido";
      const isPending = e.status === "previsto" || e.status === "confirmado";
      const valorRef = isRealized
        ? Number(e.valor_realizado ?? e.valor_previsto)
        : Number(e.valor_previsto);
      total_previsto += valorRef;
      if (isRealized) {
        total_realizado += Number(e.valor_realizado ?? e.valor_previsto);
      } else if (isPending) {
        pendente += Number(e.valor_previsto);
        count_pendente++;
      }
    }

    return { total_previsto, total_realizado, pendente, count_pendente, total: allEntries.length };
  }, [allEntries]);

  // Create manual entry (with installment/recurring projection logic)
  const create = useMutation({
    mutationFn: async (input: FinanceiroInput) => {
      // Ensure data_prevista is set from data_vencimento or data_prevista_pagamento
      const dataPrevista = input.data_prevista || input.data_vencimento || input.data_prevista_pagamento || "";
      // Calculate valor_previsto as valor liquido if valor_bruto is set
      const valorPrevisto = input.valor_bruto > 0
        ? input.valor_bruto - input.valor_desconto + input.valor_juros_multa
        : input.valor_previsto;

      const baseEntry = {
        ...input,
        data_prevista: dataPrevista,
        valor_previsto: valorPrevisto,
        user_id: user!.id,
        organization_id: orgId,
      };

      // Handle installments: create N records
      const numParcelas = input.num_parcelas && input.num_parcelas > 1 ? input.num_parcelas : 1;
      if (numParcelas > 1 && dataPrevista) {
        const valorParcela = Math.round((valorPrevisto / numParcelas) * 100) / 100;
        const entries = [];
        for (let i = 0; i < numParcelas; i++) {
          const parcelaDate = format(addMonths(new Date(dataPrevista), i), "yyyy-MM-dd");
          entries.push({
            ...baseEntry,
            descricao: `${input.descricao} (${i + 1}/${numParcelas})`,
            data_prevista: parcelaDate,
            data_vencimento: parcelaDate,
            data_prevista_pagamento: parcelaDate,
            valor_previsto: valorParcela,
            valor_bruto: valorParcela,
            num_parcelas: numParcelas,
          } as any);
        }
        const { error } = await supabase.from("cashflow_entries" as any).insert(entries);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cashflow_entries" as any).insert(baseEntry as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: tipo === "entrada" ? "Receita registrada" : "Despesa registrada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Update entry
  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<FinanceiroInput>) => {
      const { error } = await supabase.from("cashflow_entries" as any).update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Lançamento atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Mark as paid/received
  const markAsPaid = useMutation({
    mutationFn: async (entry: { id: string; valor_realizado: number; data_realizada: string; isProjected: boolean }) => {
      const status = tipo === "entrada" ? "recebido" : "pago";

      if (entry.isProjected) {
        // Find the original entry data from allEntries
        const original = allEntries.find((e) => e.id === entry.id);
        if (!original) throw new Error("Entry not found");

        // Resolve canonical source_ref so this materialization is idempotent.
        const sourceRef = (original as any).source_ref ?? extractSourceRef(original as any);

        const payload: any = {
          contract_id: original.contract_id,
          contract_installment_id: original.contract_installment_id,
          tipo: original.tipo,
          categoria: original.categoria,
          descricao: original.descricao,
          valor_previsto: original.valor_previsto,
          valor_realizado: entry.valor_realizado,
          data_prevista: original.data_prevista,
          data_realizada: entry.data_realizada,
          status,
          account_id: original.account_id,
          cost_center_id: original.cost_center_id,
          entity_id: original.entity_id,
          notes: original.notes,
          source: original.source,
          source_ref: sourceRef,
          user_id: user!.id,
          organization_id: orgId,
        };

        // Upsert by dedup_hash → repeated clicks won't duplicate.
        const { error } = sourceRef
          ? await supabase.from("cashflow_entries" as any).upsert(payload, { onConflict: "organization_id,source,source_ref" } as any)
          : await supabase.from("cashflow_entries" as any).insert(payload);
        if (error) throw error;

        // Also update installment status if linked
        if (original.contract_installment_id) {
          await supabase
            .from("contract_installments" as any)
            .update({ status } as any)
            .eq("id", original.contract_installment_id);
        }
      } else {
        // Update existing record
        const { error } = await supabase
          .from("cashflow_entries" as any)
          .update({
            status,
            valor_realizado: entry.valor_realizado,
            data_realizada: entry.data_realizada,
          } as any)
          .eq("id", entry.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: tipo === "entrada" ? "Recebimento confirmado" : "Pagamento confirmado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cashflow_entries" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Lançamento removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["financeiro_entries"] });
    qc.invalidateQueries({ queryKey: ["financeiro_installments"] });
    qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
    qc.invalidateQueries({ queryKey: ["cashflow_installments"] });
    qc.invalidateQueries({ queryKey: ["contract_installments"] });
  }

  return {
    entries: allEntries,
    totals,
    isLoading: entriesQuery.isLoading,
    create,
    update,
    markAsPaid,
    remove,
  };
}
