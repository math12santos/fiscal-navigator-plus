import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ITCOItem {
  entity_type: "system" | "equipment";
  entity_id: string;
  name: string;
  category: string | null;
  direct_cost: number;
  depreciation: number;
  incident_cost: number;
  movement_cost: number;
  tco_total: number;
  users_count: number;
  tco_per_user: number;
}

export function useITTCO(orgId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["it-tco", orgId, from, to],
    enabled: !!orgId && !!from && !!to,
    queryFn: async (): Promise<ITCOItem[]> => {
      const { data, error } = await supabase.rpc("it_tco_summary" as any, {
        p_org: orgId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return (data ?? []) as ITCOItem[];
    },
  });
}
