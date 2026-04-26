// Hook de One-on-Ones e encaminhamentos.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";

export interface HrOneOnOne {
  id: string;
  organization_id: string;
  employee_id: string;
  manager_user_id: string | null;
  data_reuniao: string;
  tipo: "mensal" | "quinzenal" | "trimestral" | "extraordinaria";
  status: "agendada" | "realizada" | "remarcada" | "cancelada" | "pendente";
  humor: "muito_bom" | "bom" | "neutro" | "ruim" | "critico" | null;
  pauta: string | null;
  pontos_discutidos: string | null;
  dificuldades: string | null;
  entregas_recentes: string | null;
  feedback_gestor: string | null;
  feedback_colaborador: string | null;
  decisoes: string | null;
  proximos_passos: string | null;
  proxima_reuniao_sugerida: string | null;
  liberado_para_colaborador: boolean;
  previous_id: string | null;
}

export interface HrOneOnOneAction {
  id: string;
  organization_id: string;
  one_on_one_id: string;
  tarefa: string;
  responsavel_user_id: string | null;
  prazo: string | null;
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  observacoes: string | null;
}

export function useOneOnOnes(filters?: { employeeId?: string; status?: string }) {
  const { currentOrg } = useOrganization();
  const { holdingMode, activeOrgIds } = useHolding();
  return useQuery({
    queryKey: ["hr_one_on_ones", holdingMode ? activeOrgIds : currentOrg?.id, filters],
    queryFn: async () => {
      let q = supabase.from("hr_one_on_ones" as any).select("*").order("data_reuniao", { ascending: false });
      if (holdingMode && activeOrgIds.length > 0) q = q.in("organization_id", activeOrgIds);
      else q = q.eq("organization_id", currentOrg!.id);
      if (filters?.employeeId) q = q.eq("employee_id", filters.employeeId);
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as HrOneOnOne[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useMutateOneOnOne() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const create = useMutation({
    mutationFn: async (input: Partial<HrOneOnOne>) => {
      const { data, error } = await supabase.from("hr_one_on_ones" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
      } as any).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_one_on_ones"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<HrOneOnOne> & { id: string }) => {
      const { error } = await supabase.from("hr_one_on_ones" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_one_on_ones"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_one_on_ones" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_one_on_ones"] }),
  });

  return { create, update, remove };
}

export function useOneOnOneActions(oneOnOneId?: string) {
  return useQuery({
    queryKey: ["hr_one_on_one_actions", oneOnOneId],
    queryFn: async () => {
      if (!oneOnOneId) return [];
      const { data, error } = await supabase
        .from("hr_one_on_one_actions" as any)
        .select("*")
        .eq("one_on_one_id", oneOnOneId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as HrOneOnOneAction[];
    },
    enabled: !!oneOnOneId,
  });
}

export function useMutateOneOnOneAction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["hr_one_on_one_actions", id] });
    qc.invalidateQueries({ queryKey: ["hr_one_on_ones"] });
  };

  const create = useMutation({
    mutationFn: async (input: Partial<HrOneOnOneAction>) => {
      const { error } = await supabase.from("hr_one_on_one_actions" as any).insert({
        ...input,
        organization_id: currentOrg!.id,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.one_on_one_id),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<HrOneOnOneAction> & { id: string }) => {
      const { error } = await supabase.from("hr_one_on_one_actions" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.one_on_one_id),
  });

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; one_on_one_id?: string }) => {
      const { error } = await supabase.from("hr_one_on_one_actions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v: any) => invalidate(v.one_on_one_id),
  });

  return { create, update, remove };
}
