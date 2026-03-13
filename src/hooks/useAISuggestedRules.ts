import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useGroupingMacrogroups } from "@/hooks/useGroupingMacrogroups";
import { useToast } from "@/hooks/use-toast";

export interface AISuggestion {
  name: string;
  match_field: string;
  operator: string;
  match_value?: string;
  match_keyword?: string;
  suggested_group: string;
  coverage: number;
  priority: number;
}

export function useAISuggestedRules() {
  const { currentOrg } = useOrganization();
  const { groups, macrogroups } = useGroupingMacrogroups();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);

  const fetchSuggestions = async () => {
    if (!currentOrg?.id) return;
    setIsLoading(true);
    setSuggestions([]);

    try {
      const existingGroups = groups.map((g) => {
        const mg = macrogroups.find((m) => m.id === g.macrogroup_id);
        return { name: g.name, macrogroup: mg?.name ?? "" };
      });

      const { data, error } = await supabase.functions.invoke("suggest-grouping-rules", {
        body: { organization_id: currentOrg.id, existing_groups: existingGroups },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }

      setSuggestions(data?.suggestions ?? []);
      setTotalEntries(data?.total_entries ?? 0);

      if ((data?.suggestions ?? []).length === 0) {
        toast({ title: "Nenhuma sugestão gerada. Verifique se há lançamentos suficientes." });
      }
    } catch (e: any) {
      console.error("AI suggestions error:", e);
      toast({ title: "Erro ao buscar sugestões da IA", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return { suggestions, isLoading, totalEntries, fetchSuggestions };
}
