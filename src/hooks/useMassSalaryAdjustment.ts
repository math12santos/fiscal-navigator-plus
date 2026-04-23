import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export type AdjustmentMode = "percentage" | "fixed";

export interface MassAdjustmentParams {
  /** IDs de colaboradores afetados (já filtrados). */
  employeeIds: string[];
  mode: AdjustmentMode;
  /** Se mode='percentage' valor em % (ex: 5 = +5%). Se 'fixed', valor em R$ adicionado ao salário. */
  amount: number;
  reason?: string;
  effectiveDate?: string;
}

/**
 * Reajuste em massa (ex.: dissídio).
 * - Atualiza salary_base de cada colaborador
 * - Cria registro em employee_compensations com type='reajuste' e recurrence='dissidio'
 */
export function useMassSalaryAdjustment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (params: MassAdjustmentParams) => {
      if (!params.employeeIds.length) return { updated: 0 };

      const { data: emps, error: fetchErr } = await supabase
        .from("employees")
        .select("id, name, salary_base")
        .in("id", params.employeeIds);
      if (fetchErr) throw fetchErr;

      let updated = 0;
      for (const emp of emps ?? []) {
        const old = Number(emp.salary_base || 0);
        const next =
          params.mode === "percentage"
            ? Math.round(old * (1 + params.amount / 100) * 100) / 100
            : Math.round((old + params.amount) * 100) / 100;
        if (next === old) continue;

        const { error: upErr } = await supabase
          .from("employees")
          .update({ salary_base: next })
          .eq("id", emp.id);
        if (upErr) throw upErr;

        const { error: hErr } = await supabase.from("employee_compensations").insert({
          organization_id: currentOrg!.id,
          user_id: user!.id,
          employee_id: emp.id,
          type: "reajuste",
          description:
            params.reason ||
            (params.mode === "percentage"
              ? `Reajuste coletivo +${params.amount}%`
              : `Reajuste coletivo +R$ ${params.amount.toFixed(2)}`),
          value: next - old,
          recurrence: "dissidio",
          active: true,
        });
        if (hErr) throw hErr;
        updated++;
      }
      return { updated };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["compensations"] });
    },
  });
}
