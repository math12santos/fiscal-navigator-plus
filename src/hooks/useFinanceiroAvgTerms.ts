/**
 * useFinanceiroAvgTerms
 *
 * Calcula PMP (Prazo Médio de Pagamento) ou PMR (Prazo Médio de Recebimento)
 * a partir de cashflow_entries.
 *
 * Conceito:
 *   - PMP = média ponderada (por valor pago) de dias entre o último dia do
 *     mês de competência e a data de pagamento realizada.
 *   - PMR = mesma fórmula para recebimentos.
 *
 * Considera apenas lançamentos:
 *   - status ∈ {pago, recebido}
 *   - data_realizada NOT NULL
 *   - competencia NOT NULL (formato "YYYY-MM")
 *   - dentro da janela (default últimos 90 dias por data_realizada)
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { format, subDays, lastDayOfMonth, parseISO, differenceInDays, startOfMonth } from "date-fns";

export interface AvgTermsBucket {
  label: string;
  count: number;
  total: number;
}

export interface AvgTermsByEntity {
  entity_id: string | null;
  entity_name: string;
  avg_days: number;
  total_pago: number;
  count: number;
}

export interface AvgTermsMonthly {
  month: string; // YYYY-MM (mês do pagamento)
  avg_days: number;
  total_pago: number;
  count: number;
}

export interface AvgTermsResult {
  pmp_pmr_days: number;       // valor principal (dias)
  total_pago: number;         // soma valor_realizado
  count: number;              // número de lançamentos considerados
  cobertura_pct: number;      // % de lançamentos pagos com competência preenchida
  count_sem_competencia: number;
  buckets: AvgTermsBucket[];  // 0-30, 31-60, 61-90, 90+
  monthly: AvgTermsMonthly[]; // últimos 6 meses
  topEntities: AvgTermsByEntity[]; // top 5 fornecedores/clientes por prazo
  semCompetencia: { id: string; descricao: string; valor: number; data_realizada: string }[];
}

const DEFAULT_WINDOW_DAYS = 90;

export function useFinanceiroAvgTerms(
  tipo: "saida" | "entrada",
  windowDays: number = DEFAULT_WINDOW_DAYS,
) {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  const orgId = currentOrg?.id;

  const dataRealizadaFrom = useMemo(
    () => format(subDays(new Date(), windowDays), "yyyy-MM-dd"),
    [windowDays],
  );

  const query = useQuery({
    queryKey: [
      "financeiro_avg_terms",
      tipo,
      holdingMode ? activeOrgIds.join(",") : orgId,
      dataRealizadaFrom,
    ],
    queryFn: async () => {
      let q = supabase
        .from("cashflow_entries" as any)
        .select(
          "id, descricao, valor_realizado, valor_previsto, data_realizada, competencia, entity_id, status",
        )
        .eq("tipo", tipo)
        .not("data_realizada", "is", null)
        .gte("data_realizada", dataRealizadaFrom)
        .in("status", tipo === "saida" ? ["pago"] : ["recebido", "pago"]);

      if (holdingMode && activeOrgIds.length > 0) {
        q = q.in("organization_id", activeOrgIds);
      } else if (orgId) {
        q = q.eq("organization_id", orgId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId || (holdingMode && activeOrgIds.length > 0),
    staleTime: 60_000,
  });

  // Buscar nomes de entidades em batch (separado para evitar joins pesados)
  const entityIds = useMemo(() => {
    const ids = new Set<string>();
    (query.data ?? []).forEach((r) => {
      if (r.entity_id) ids.add(r.entity_id);
    });
    return Array.from(ids);
  }, [query.data]);

  const entityNamesQuery = useQuery({
    queryKey: ["financeiro_entity_names", entityIds.join(",")],
    queryFn: async () => {
      if (entityIds.length === 0) return new Map<string, string>();
      const { data } = await supabase
        .from("entities" as any)
        .select("id, name")
        .in("id", entityIds);
      const map = new Map<string, string>();
      (data ?? []).forEach((e: any) => map.set(e.id, e.name));
      return map;
    },
    enabled: entityIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const result = useMemo<AvgTermsResult>(() => {
    const empty: AvgTermsResult = {
      pmp_pmr_days: 0,
      total_pago: 0,
      count: 0,
      cobertura_pct: 100,
      count_sem_competencia: 0,
      buckets: [
        { label: "0-30 dias", count: 0, total: 0 },
        { label: "31-60 dias", count: 0, total: 0 },
        { label: "61-90 dias", count: 0, total: 0 },
        { label: "90+ dias", count: 0, total: 0 },
      ],
      monthly: [],
      topEntities: [],
      semCompetencia: [],
    };
    const rows = query.data ?? [];
    if (rows.length === 0) return empty;

    const entityNames = entityNamesQuery.data ?? new Map<string, string>();

    let weightedSum = 0;
    let totalValor = 0;
    let count = 0;
    let countSem = 0;

    const buckets = [
      { label: "0-30 dias", count: 0, total: 0 },
      { label: "31-60 dias", count: 0, total: 0 },
      { label: "61-90 dias", count: 0, total: 0 },
      { label: "90+ dias", count: 0, total: 0 },
    ];

    const byEntity = new Map<string, { sumWeighted: number; sumValor: number; count: number; name: string }>();
    const byMonth = new Map<string, { sumWeighted: number; sumValor: number; count: number }>();
    const semCompetencia: AvgTermsResult["semCompetencia"] = [];

    for (const row of rows) {
      const valor = Math.abs(Number(row.valor_realizado ?? row.valor_previsto ?? 0));
      if (!valor || !row.data_realizada) continue;

      if (!row.competencia) {
        countSem += 1;
        if (semCompetencia.length < 50) {
          semCompetencia.push({
            id: row.id,
            descricao: row.descricao,
            valor,
            data_realizada: row.data_realizada,
          });
        }
        continue;
      }

      // competencia "YYYY-MM" → último dia do mês
      let compDate: Date;
      try {
        compDate = lastDayOfMonth(parseISO(`${row.competencia}-01`));
      } catch {
        continue;
      }
      const realizada = parseISO(row.data_realizada);
      const days = Math.max(0, differenceInDays(realizada, compDate));

      weightedSum += days * valor;
      totalValor += valor;
      count += 1;

      // Buckets
      const idx = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
      buckets[idx].count += 1;
      buckets[idx].total += valor;

      // Por entidade
      if (row.entity_id) {
        const key = row.entity_id;
        const entry = byEntity.get(key) ?? {
          sumWeighted: 0,
          sumValor: 0,
          count: 0,
          name: entityNames.get(key) ?? "—",
        };
        entry.sumWeighted += days * valor;
        entry.sumValor += valor;
        entry.count += 1;
        byEntity.set(key, entry);
      }

      // Por mês de pagamento
      const monthKey = format(startOfMonth(realizada), "yyyy-MM");
      const monthEntry = byMonth.get(monthKey) ?? { sumWeighted: 0, sumValor: 0, count: 0 };
      monthEntry.sumWeighted += days * valor;
      monthEntry.sumValor += valor;
      monthEntry.count += 1;
      byMonth.set(monthKey, monthEntry);
    }

    const pmp = totalValor > 0 ? weightedSum / totalValor : 0;
    const totalRows = count + countSem;
    const cobertura = totalRows > 0 ? (count / totalRows) * 100 : 100;

    const topEntities: AvgTermsByEntity[] = Array.from(byEntity.entries())
      .map(([id, e]) => ({
        entity_id: id,
        entity_name: e.name,
        avg_days: e.sumValor > 0 ? e.sumWeighted / e.sumValor : 0,
        total_pago: e.sumValor,
        count: e.count,
      }))
      .sort((a, b) => b.avg_days - a.avg_days)
      .slice(0, 5);

    const monthly: AvgTermsMonthly[] = Array.from(byMonth.entries())
      .map(([month, e]) => ({
        month,
        avg_days: e.sumValor > 0 ? e.sumWeighted / e.sumValor : 0,
        total_pago: e.sumValor,
        count: e.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    return {
      pmp_pmr_days: Math.round(pmp * 10) / 10,
      total_pago: totalValor,
      count,
      cobertura_pct: Math.round(cobertura),
      count_sem_competencia: countSem,
      buckets,
      monthly,
      topEntities,
      semCompetencia,
    };
  }, [query.data, entityNamesQuery.data]);

  return {
    ...result,
    isLoading: query.isLoading || entityNamesQuery.isLoading,
    windowDays,
  };
}
