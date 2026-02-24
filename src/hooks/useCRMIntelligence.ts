import { useMemo } from "react";
import { CRMOpportunity, PipelineStage, CRMClient } from "@/hooks/useCRM";
import { differenceInDays } from "date-fns";

export interface CRMIntelligenceData {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  overallConversion: number;
  avgSalesCycleDays: number;
  conversionByStage: { stageName: string; count: number; value: number; probability: number }[];
  forecastByMonth: { month: string; value: number }[];
  clientsByStatus: Record<string, number>;
  avgMRR: number;
  avgHealthScore: number;
}

export function useCRMIntelligence(
  opportunities: CRMOpportunity[],
  stages: PipelineStage[],
  clients: CRMClient[]
): CRMIntelligenceData {
  return useMemo(() => {
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    // Active (non-won, non-lost) opportunities
    const activeOpps = opportunities.filter((o) => !o.won_at && !o.lost_at);
    const wonOpps = opportunities.filter((o) => !!o.won_at);

    // Total pipeline value
    const totalPipelineValue = activeOpps.reduce((s, o) => s + Number(o.estimated_value), 0);

    // Weighted pipeline value
    const weightedPipelineValue = activeOpps.reduce((s, o) => {
      const stage = stageMap.get(o.stage_id);
      const prob = stage ? Number(stage.probability) / 100 : 0;
      return s + Number(o.estimated_value) * prob;
    }, 0);

    // Overall conversion (won / total closed)
    const closedOpps = opportunities.filter((o) => !!o.won_at || !!o.lost_at);
    const overallConversion = closedOpps.length > 0 ? (wonOpps.length / closedOpps.length) * 100 : 0;

    // Avg sales cycle (days between created_at and won_at)
    const cycles = wonOpps
      .map((o) => differenceInDays(new Date(o.won_at!), new Date(o.created_at)))
      .filter((d) => d >= 0);
    const avgSalesCycleDays = cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;

    // Conversion by stage
    const conversionByStage = stages
      .filter((s) => !s.is_lost)
      .map((s) => {
        const opps = opportunities.filter((o) => o.stage_id === s.id);
        return {
          stageName: s.name,
          count: opps.length,
          value: opps.reduce((sum, o) => sum + Number(o.estimated_value), 0),
          probability: Number(s.probability),
        };
      });

    // Forecast by month (estimated_close_date × probability)
    const forecastMap: Record<string, number> = {};
    for (const o of activeOpps) {
      if (!o.estimated_close_date) continue;
      const month = o.estimated_close_date.substring(0, 7);
      const stage = stageMap.get(o.stage_id);
      const prob = stage ? Number(stage.probability) / 100 : 0;
      forecastMap[month] = (forecastMap[month] ?? 0) + Number(o.estimated_value) * prob;
    }
    const forecastByMonth = Object.entries(forecastMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value }));

    // Client stats
    const clientsByStatus: Record<string, number> = {};
    for (const c of clients) {
      clientsByStatus[c.status] = (clientsByStatus[c.status] ?? 0) + 1;
    }

    const activeClients = clients.filter((c) => c.active);
    const avgMRR = activeClients.length > 0
      ? activeClients.reduce((s, c) => s + Number(c.mrr), 0) / activeClients.length
      : 0;
    const avgHealthScore = activeClients.length > 0
      ? Math.round(activeClients.reduce((s, c) => s + c.health_score, 0) / activeClients.length)
      : 0;

    return {
      totalPipelineValue,
      weightedPipelineValue,
      overallConversion,
      avgSalesCycleDays,
      conversionByStage,
      forecastByMonth,
      clientsByStatus,
      avgMRR,
      avgHealthScore,
    };
  }, [opportunities, stages, clients]);
}
