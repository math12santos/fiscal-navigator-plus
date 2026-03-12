import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ExpenseSplit {
  id: string;
  cashflow_entry_id: string;
  cost_center_id: string;
  percentual: number;
  valor: number;
  created_at: string;
}

export function useExpenseSplits(entryId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["expense_splits", entryId];

  const { data: splits = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_cost_center_splits" as any)
        .select("*")
        .eq("cashflow_entry_id", entryId!);
      if (error) throw error;
      return data as unknown as ExpenseSplit[];
    },
  });

  const saveSplits = useMutation({
    mutationFn: async (newSplits: Omit<ExpenseSplit, "id" | "created_at">[]) => {
      // Delete existing and replace
      if (entryId) {
        await supabase.from("expense_cost_center_splits" as any).delete().eq("cashflow_entry_id", entryId);
      }
      if (newSplits.length > 0) {
        const { error } = await supabase.from("expense_cost_center_splits" as any).insert(newSplits as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Rateio salvo" });
    },
    onError: (e: any) => toast({ title: "Erro no rateio", description: e.message, variant: "destructive" }),
  });

  return { splits, isLoading, saveSplits };
}
