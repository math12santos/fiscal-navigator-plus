import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { toast } from "sonner";

export function useITDepreciation() {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  const orgIds =
    holdingMode && activeOrgIds.length > 0
      ? activeOrgIds
      : currentOrg?.id
        ? [currentOrg.id]
        : [];
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["it_depreciation", orgIds],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_depreciation_params" as any)
        .select("*")
        .in("organization_id", orgIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const update = useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input };

      // Auto-calc valor contábil e base depreciável
      const gross = Number(payload.invoice_gross_value ?? 0);
      const recov = Number(payload.recoverable_taxes ?? 0);
      const freight = Number(payload.freight_install_setup ?? 0);
      const disc = Number(payload.discounts ?? 0);
      payload.accounting_value = +(gross - recov - disc + freight).toFixed(2);
      payload.depreciable_base = +(payload.accounting_value - Number(payload.accounting_residual_value ?? 0)).toFixed(2);

      // Depreciação econômica mensal
      const econLife = Number(payload.economic_useful_life_months ?? 0);
      if (econLife > 0) {
        const acq = Number(payload.accounting_value ?? 0);
        const econRes = Number(payload.economic_residual_value ?? 0);
        payload.monthly_economic_depreciation = +((acq - econRes) / econLife).toFixed(2);
      }

      if (payload.requires_finance_input) {
        payload.requires_finance_input = false;
        payload.finance_completed_at = new Date().toISOString();
        payload.finance_completed_by = u.user?.id;
      }

      const { data, error } = await supabase
        .from("it_depreciation_params" as any)
        .update(payload)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_depreciation"] });
      toast.success("Depreciação atualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  return { list, update };
}
