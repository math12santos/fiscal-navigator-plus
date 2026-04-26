// Hook do BSC: scorecards, indicadores e histórico mensal.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";

export interface BscScorecard {
  id: string;
  organization_id: string;
  nome: string;
  tipo: "individual" | "departamento" | "empresa";
  employee_id: string | null;
  department_id: string | null;
  manager_user_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  status: "em_elaboracao" | "ativo" | "encerrado";
  resultado_geral: number;
  observacoes: string | null;
  liberado_para_colaborador: boolean;
}

export interface BscIndicator {
  id: string;
  organization_id: string;
  bsc_id: string;
  perspectiva: "financeira" | "clientes" | "processos" | "aprendizado";
  nome: string;
  descricao: string | null;
  meta: number;
  realizado: number;
  unidade: string;
  peso: number;
  frequencia: "mensal" | "trimestral" | "semestral" | "anual";
  fonte_dado: string | null;
  responsavel_user_id: string | null;
  quanto_menor_melhor: boolean;
  percentual_atingimento: number;
  nota_ponderada: number;
  status: "abaixo" | "parcial" | "atingido" | "superado";
}

export function useBSCScorecards(filters?: { employeeId?: string; departmentId?: string; status?: string }) {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  return useQuery({
    queryKey: ["hr_bsc", holdingMode ? activeOrgIds : currentOrg?.id, filters],
    queryFn: async () => {
      let q = supabase.from("hr_bsc_scorecards" as any).select("*").order("periodo_inicio", { ascending: false });
      if (holdingMode && activeOrgIds.length > 0) q = q.in("organization_id", activeOrgIds);
      else q = q.eq("organization_id", currentOrg!.id);
      if (filters?.employeeId) q = q.eq("employee_id", filters.employeeId);
      if (filters?.departmentId) q = q.eq("department_id", filters.departmentId);
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BscScorecard[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateBSC() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (input: Partial<BscScorecard>) => {
      const { data, error } = await supabase.from("hr_bsc_scorecards" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
      } as any).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_bsc"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BscScorecard> & { id: string }) => {
      const { error } = await supabase.from("hr_bsc_scorecards" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_bsc"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_bsc_scorecards" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_bsc"] }),
  });

  return { create, update, remove };
}

export function useBSCIndicators(bscId?: string) {
  return useQuery({
    queryKey: ["hr_bsc_indicators", bscId],
    queryFn: async () => {
      if (!bscId) return [];
      const { data, error } = await supabase.from("hr_bsc_indicators" as any).select("*").eq("bsc_id", bscId).order("perspectiva, nome");
      if (error) throw error;
      return (data ?? []) as unknown as BscIndicator[];
    },
    enabled: !!bscId,
  });
}

export function useMutateBSCIndicator() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const invalidate = (bscId?: string) => {
    qc.invalidateQueries({ queryKey: ["hr_bsc_indicators", bscId] });
    qc.invalidateQueries({ queryKey: ["hr_bsc"] });
    qc.invalidateQueries({ queryKey: ["hr_bsc_history"] });
  };

  const create = useMutation({
    mutationFn: async (input: Partial<BscIndicator>) => {
      const { error } = await supabase.from("hr_bsc_indicators" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.bsc_id),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BscIndicator> & { id: string }) => {
      const { error } = await supabase.from("hr_bsc_indicators" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.bsc_id),
  });

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; bsc_id?: string }) => {
      const { error } = await supabase.from("hr_bsc_indicators" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.bsc_id),
  });

  return { create, update, remove };
}

export function useBSCHistory(bscId?: string) {
  return useQuery({
    queryKey: ["hr_bsc_history", bscId],
    queryFn: async () => {
      if (!bscId) return [];
      const { data, error } = await supabase
        .from("hr_bsc_history" as any).select("*").eq("bsc_id", bscId).order("periodo_mes");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!bscId,
  });
}
