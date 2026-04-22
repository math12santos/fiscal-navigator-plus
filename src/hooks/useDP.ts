import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useUserDataScope } from "@/hooks/useUserDataScope";
import { useHolding } from "@/contexts/HoldingContext";

// ========== EMPLOYEES ==========
export function useEmployees() {
  const { currentOrg } = useOrganization();
  const { filterByScope } = useUserDataScope();
  const { holdingMode, activeOrgIds } = useHolding();

  const query = useQuery({
    queryKey: ["employees", holdingMode ? activeOrgIds : currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("employees").select("*").order("name");
      if (holdingMode && activeOrgIds.length > 0) {
        q = q.in("organization_id", activeOrgIds);
      } else {
        q = q.eq("organization_id", currentOrg!.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
  const employees = useMemo(() => filterByScope(query.data ?? []), [query.data, filterByScope]);
  return { ...query, data: employees };
}

export function useMutateEmployee() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (emp: any) => {
      const { error } = await supabase.from("employees").insert({
        ...emp,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("employees").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  return { create, update, remove };
}

// ========== COMPENSATIONS ==========
export function useCompensations(employeeId?: string) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["compensations", currentOrg?.id, employeeId],
    queryFn: async () => {
      let q = supabase.from("employee_compensations").select("*").eq("organization_id", currentOrg!.id);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateCompensation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (comp: any) => {
      const { error } = await supabase.from("employee_compensations").insert({
        ...comp,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compensations"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_compensations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compensations"] }),
  });

  return { create, remove };
}

// ========== POSITIONS ==========
export function usePositions() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["positions", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("level_hierarchy");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutatePosition() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (pos: any) => {
      const { error } = await supabase.from("positions").insert({
        ...pos,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("positions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("positions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });

  return { create, update, remove };
}

// ========== ROUTINES ==========
export function useRoutines(positionId?: string) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["routines", currentOrg?.id, positionId],
    queryFn: async () => {
      let q = supabase.from("position_routines").select("*").eq("organization_id", currentOrg!.id);
      if (positionId) q = q.eq("position_id", positionId);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateRoutine() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (r: any) => {
      const { error } = await supabase.from("position_routines").insert({
        ...r,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("position_routines").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("position_routines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });

  return { create, update, remove };
}

// ========== PAYROLL ==========
export function usePayrollRuns() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["payroll_runs", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function usePayrollItems(runId?: string) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["payroll_items", currentOrg?.id, runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_items")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .eq("payroll_run_id", runId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id && !!runId,
  });
}

export function useMutatePayroll() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const createRun = useMutation({
    mutationFn: async (run: any) => {
      const { data, error } = await supabase.from("payroll_runs").insert({
        ...run,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_runs"] }),
  });

  const updateRun = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("payroll_runs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_runs"] }),
  });

  const upsertItem = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("payroll_items").upsert({
        ...item,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll_items"] }),
  });

  return { createRun, updateRun, upsertItem };
}

// ========== VACATIONS ==========
export function useVacations() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["vacations", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("periodo_aquisitivo_fim", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateVacation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await supabase.from("employee_vacations").insert({
        ...v,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacations"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("employee_vacations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacations"] }),
  });

  return { create, update };
}

// ========== TERMINATIONS ==========
export function useTerminations() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["terminations", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_terminations")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("termination_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateTermination() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (t: any) => {
      const { data, error } = await supabase.from("employee_terminations").insert({
        ...t,
        user_id: user!.id,
        organization_id: currentOrg!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["terminations"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("employee_terminations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["terminations"] }),
  });

  return { create, update };
}

// ========== DP CONFIG ==========
export function useDPConfig() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["dp_config", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dp_config")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateDPConfig() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (config: any) => {
      const { error } = await supabase.from("dp_config").upsert({
        ...config,
        organization_id: currentOrg!.id,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dp_config"] }),
  });
}

// ========== HR PLANNING ==========
export function useHRPlanning() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["hr_planning", currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_planning_items")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("planned_date");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateHRPlanning() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (item: any) => {
      const { data: created, error } = await supabase
        .from("hr_planning_items")
        .insert({
          ...item,
          user_id: user!.id,
          organization_id: currentOrg!.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-create governance request (task) for HR
      const isHire = item.type === "contratacao";
      const isFire = item.type === "desligamento";
      const titlePrefix = isHire
        ? "Contratação planejada"
        : isFire
          ? "Desligamento planejado"
          : "Reajuste planejado";

      // Due date 7 days before planned_date for advance preparation
      const planned = new Date(item.planned_date);
      const due = new Date(planned);
      due.setDate(due.getDate() - 7);
      const dueStr = due.toISOString().slice(0, 10);

      const { data: req, error: reqErr } = await supabase
        .from("requests" as any)
        .insert({
          organization_id: currentOrg!.id,
          user_id: user!.id,
          title: `${titlePrefix} (${item.quantity || 1}x)`,
          description: item.notes || `Item de planejamento RH — preparar processos para ${item.planned_date}`,
          type: "rh_planning",
          area_responsavel: "dp",
          priority: "media",
          due_date: dueStr,
          cost_center_id: item.cost_center_id || null,
          reference_module: "hr_planning",
          reference_id: (created as any).id,
          status: "aberta",
          competencia: item.planned_date.slice(0, 7),
        })
        .select()
        .single();

      if (!reqErr && req) {
        await supabase.from("request_tasks" as any).insert({
          request_id: (req as any).id,
          organization_id: currentOrg!.id,
          title: titlePrefix,
          due_date: dueStr,
          created_by: user!.id,
        });
      }

      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_planning"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["my_request_tasks"] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("hr_planning_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_planning"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_planning_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_planning"] }),
  });

  /**
   * Marks an HR planning item as executed and creates a forecasted cashflow entry
   * representing the financial impact (salary + employer charges for hires/raises,
   * termination cost for firings handled separately via DPRescisoes).
   */
  const execute = useMutation({
    mutationFn: async (item: any) => {
      const isHire = item.type === "contratacao";
      const isRaise = item.type === "reajuste";
      // Only hires and raises create recurring forecasted expense here.
      // Terminations have their own dedicated workflow in DPRescisoes.
      if (!isHire && !isRaise) {
        const { error } = await supabase
          .from("hr_planning_items")
          .update({ status: "executado" })
          .eq("id", item.id);
        if (error) throw error;
        return;
      }

      const totalCost = Number(item.total_cost_estimated || 0);
      const descricao = isHire
        ? `Folha — Contratação planejada (${item.quantity || 1}x)`
        : `Folha — Reajuste planejado`;

      const { error: cfErr } = await supabase.from("cashflow_entries").upsert({
        organization_id: currentOrg!.id,
        user_id: user!.id,
        descricao,
        tipo: "saida",
        valor_previsto: totalCost,
        data_prevista: item.planned_date,
        data_vencimento: item.planned_date,
        competencia: item.planned_date.slice(0, 7),
        cost_center_id: item.cost_center_id || null,
        status: "previsto",
        source: "hr_planning",
        source_ref: `hr:${item.id}`,
        categoria: "Folha de Pagamento",
        impacto_fluxo_caixa: true,
        impacto_orcamento: true,
        notes: `Gerado a partir de Planejamento RH (${item.type}). Item: ${item.id}`,
      } as any, { onConflict: "dedup_hash" } as any);
      if (cfErr) throw cfErr;

      const { error } = await supabase
        .from("hr_planning_items")
        .update({ status: "executado" })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_planning"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
    },
  });

  return { create, update, remove, execute };
}

// ========== PAYROLL CALCULATION HELPERS ==========
export function calcINSSEmpregado(salario: number): number {
  // Tabela INSS 2024 simplificada
  if (salario <= 1412.00) return salario * 0.075;
  if (salario <= 2666.68) return 1412 * 0.075 + (salario - 1412) * 0.09;
  if (salario <= 4000.03) return 1412 * 0.075 + (2666.68 - 1412) * 0.09 + (salario - 2666.68) * 0.12;
  if (salario <= 7786.02) return 1412 * 0.075 + (2666.68 - 1412) * 0.09 + (4000.03 - 2666.68) * 0.12 + (salario - 4000.03) * 0.14;
  return 1412 * 0.075 + (2666.68 - 1412) * 0.09 + (4000.03 - 2666.68) * 0.12 + (7786.02 - 4000.03) * 0.14;
}

export function calcIRRF(baseCalculo: number): number {
  // Tabela IRRF 2024 simplificada
  const deducao = 564.80; // Parcela a deduzir simplificada
  const base = baseCalculo - deducao;
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return base * 0.075 - 169.44;
  if (base <= 3751.05) return base * 0.15 - 381.44;
  if (base <= 4664.68) return base * 0.225 - 662.77;
  return base * 0.275 - 896.00;
}

export function calcEncargosPatronais(salario: number, config: any, contractType?: string) {
  // PJ contractors have no social charges (INSS, RAT, FGTS, Terceiros)
  if (contractType === "PJ") {
    return { inssPatronal: 0, rat: 0, fgts: 0, terceiros: 0, total: 0 };
  }
  const inssPatronal = salario * ((config?.inss_patronal_pct ?? 20) / 100);
  const rat = salario * ((config?.rat_pct ?? 2) / 100);
  const fgts = salario * ((config?.fgts_pct ?? 8) / 100);
  const terceiros = salario * ((config?.terceiros_pct ?? 5.8) / 100);
  return { inssPatronal, rat, fgts, terceiros, total: inssPatronal + rat + fgts + terceiros };
}
