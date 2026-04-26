// Hook de PDIs e ações.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";

export interface HrPdi {
  id: string;
  organization_id: string;
  employee_id: string;
  manager_user_id: string | null;
  created_by: string;
  objetivo: string;
  competencia: string | null;
  justificativa: string | null;
  data_inicio: string;
  data_conclusao_prevista: string | null;
  data_conclusao_real: string | null;
  status: "nao_iniciado" | "em_andamento" | "em_atraso" | "concluido" | "cancelado";
  percentual_evolucao: number;
  obs_rh: string | null;
  obs_gestor: string | null;
  obs_colaborador: string | null;
  liberado_para_colaborador: boolean;
  source_one_on_one_id: string | null;
  source_9box_id: string | null;
  ultima_atualizacao_em: string | null;
}

export interface HrPdiAction {
  id: string;
  organization_id: string;
  pdi_id: string;
  acao: string;
  tipo: "treinamento" | "mentoria" | "pratica" | "leitura" | "curso" | "reuniao" | "outro";
  responsavel_user_id: string | null;
  prazo: string | null;
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  evidencia: string | null;
  comentarios: string | null;
  concluida_em: string | null;
}

export function usePDIs(filters?: { employeeId?: string; status?: string }) {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();

  return useQuery({
    queryKey: ["hr_pdis", holdingMode ? activeOrgIds : currentOrg?.id, filters],
    queryFn: async () => {
      let q = supabase.from("hr_pdis" as any).select("*").order("created_at", { ascending: false });
      if (holdingMode && activeOrgIds.length > 0) q = q.in("organization_id", activeOrgIds);
      else q = q.eq("organization_id", currentOrg!.id);
      if (filters?.employeeId) q = q.eq("employee_id", filters.employeeId);
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as HrPdi[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutatePDI() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (input: Partial<HrPdi>) => {
      const { data, error } = await supabase.from("hr_pdis" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
        created_by: user!.id,
      } as any).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_pdis"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<HrPdi> & { id: string }) => {
      const { error } = await supabase.from("hr_pdis" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_pdis"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_pdis" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_pdis"] }),
  });

  return { create, update, remove };
}

export function usePDIActions(pdiId?: string) {
  return useQuery({
    queryKey: ["hr_pdi_actions", pdiId],
    queryFn: async () => {
      if (!pdiId) return [];
      const { data, error } = await supabase
        .from("hr_pdi_actions" as any)
        .select("*")
        .eq("pdi_id", pdiId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as HrPdiAction[];
    },
    enabled: !!pdiId,
  });
}

export function useMutatePDIAction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const invalidate = (pdiId?: string) => {
    qc.invalidateQueries({ queryKey: ["hr_pdi_actions", pdiId] });
    qc.invalidateQueries({ queryKey: ["hr_pdis"] });
  };

  const create = useMutation({
    mutationFn: async (input: Partial<HrPdiAction>) => {
      const { error } = await supabase.from("hr_pdi_actions" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.pdi_id),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<HrPdiAction> & { id: string }) => {
      const updates: any = { ...patch };
      if (patch.status === "concluida" && !patch.concluida_em) {
        updates.concluida_em = new Date().toISOString();
      }
      const { error } = await supabase.from("hr_pdi_actions" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.pdi_id),
  });

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; pdi_id?: string }) => {
      const { error } = await supabase.from("hr_pdi_actions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.pdi_id),
  });

  return { create, update, remove };
}
