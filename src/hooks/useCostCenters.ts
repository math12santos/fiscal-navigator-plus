import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "./useAuditLog";
import { saveCostCenterPermissions } from "./useCostCenterPermissions";

export interface CostCenter {
  id: string;
  user_id: string;
  code: string;
  name: string;
  parent_id: string | null;
  business_unit: string | null;
  responsible: string | null;
  responsible_name?: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type CreateInput = Omit<CostCenter, "id" | "user_id" | "created_at" | "updated_at" | "responsible_name"> & {
  permissions?: { module_key: string; tab_key: string | null; role: string; allowed: boolean }[];
};
type UpdateInput = { id: string } & Partial<Omit<CreateInput, "permissions">> & {
  permissions?: { module_key: string; tab_key: string | null; role: string; allowed: boolean }[];
};

async function syncResponsibleAccess(
  costCenterId: string,
  newResponsible: string | null,
  oldResponsible: string | null,
  orgId: string
) {
  if (newResponsible) {
    await supabase
      .from("user_cost_center_access" as any)
      .upsert(
        { user_id: newResponsible, cost_center_id: costCenterId, organization_id: orgId, granted_by: "system" },
        { onConflict: "user_id,cost_center_id" }
      );
  }
  if (oldResponsible && oldResponsible !== newResponsible) {
    const { data: otherCCs } = await supabase
      .from("cost_centers" as any)
      .select("id")
      .eq("responsible", oldResponsible)
      .eq("organization_id", orgId)
      .neq("id", costCenterId);
    if (!otherCCs || otherCCs.length === 0) {
      await supabase
        .from("user_cost_center_access" as any)
        .delete()
        .eq("user_id", oldResponsible)
        .eq("cost_center_id", costCenterId)
        .eq("organization_id", orgId);
    }
  }
}

export function useCostCenters() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { log } = useAuditLog();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["cost_centers", orgId],
    queryFn: async () => {
      let q = supabase
        .from("cost_centers" as any)
        .select("*, profiles:responsible(full_name)")
        .order("code", { ascending: true });
      if (orgId) q = q.eq("organization_id", orgId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]).map((cc) => ({
        ...cc,
        responsible_name: cc.profiles?.full_name ?? null,
        profiles: undefined,
      })) as CostCenter[];
    },
    enabled: !!user && !!orgId,
  });

  const create = useMutation({
    mutationFn: async ({ permissions, ...input }: CreateInput) => {
      const { data, error } = await supabase
        .from("cost_centers" as any)
        .insert({ ...input, user_id: user!.id, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      const cc = data as unknown as CostCenter;

      // Save permissions
      if (permissions && permissions.length > 0 && orgId) {
        await saveCostCenterPermissions(cc.id, orgId, permissions);
      }

      return cc;
    },
    onSuccess: async (data) => {
      if (data.responsible && orgId) {
        await syncResponsibleAccess(data.id, data.responsible, null, orgId);
        qc.invalidateQueries({ queryKey: ["user_cost_center_access"] });
      }
      qc.invalidateQueries({ queryKey: ["cost_centers", orgId] });
      qc.invalidateQueries({ queryKey: ["cost_center_permissions"] });
      qc.invalidateQueries({ queryKey: ["cost_center_permissions_bulk"] });
      log({ entity_type: "cost_centers", entity_id: data.id, action: "INSERT", new_data: data as any });
      toast({ title: "Centro de custo criado" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, permissions, ...input }: UpdateInput) => {
      const { data: old } = await supabase
        .from("cost_centers" as any)
        .select("responsible")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("cost_centers" as any)
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Save permissions
      if (permissions && orgId) {
        await saveCostCenterPermissions(id, orgId, permissions);
      }

      return { ...(data as unknown as CostCenter), _oldResponsible: (old as any)?.responsible ?? null };
    },
    onSuccess: async (data: any) => {
      const oldResponsible = data._oldResponsible;
      const newResponsible = data.responsible;
      if (orgId && (newResponsible || oldResponsible)) {
        await syncResponsibleAccess(data.id, newResponsible, oldResponsible, orgId);
        qc.invalidateQueries({ queryKey: ["user_cost_center_access"] });
      }
      qc.invalidateQueries({ queryKey: ["cost_centers", orgId] });
      qc.invalidateQueries({ queryKey: ["cost_center_permissions"] });
      qc.invalidateQueries({ queryKey: ["cost_center_permissions_bulk"] });
      log({ entity_type: "cost_centers", entity_id: data.id, action: "UPDATE", new_data: data as any });
      toast({ title: "Centro de custo atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await supabase
        .from("cost_centers" as any)
        .update({ active })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CostCenter;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cost_centers", orgId] });
      log({
        entity_type: "cost_centers",
        entity_id: data.id,
        action: data.active ? "ACTIVATE" : "DEACTIVATE",
        new_data: data as any,
      });
      toast({ title: data.active ? "Centro ativado" : "Centro desativado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_centers" as any).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["cost_centers", orgId] });
      log({ entity_type: "cost_centers", entity_id: id, action: "DELETE" });
      toast({ title: "Centro de custo removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const deleteAll = async () => {
    if (!user || !orgId) throw new Error("Usuário ou organização não definidos");
    const { error: childErr } = await supabase
      .from("cost_centers" as any)
      .delete()
      .eq("organization_id", orgId)
      .not("parent_id", "is", null);
    if (childErr) throw childErr;
    const { error: parentErr } = await supabase
      .from("cost_centers" as any)
      .delete()
      .eq("organization_id", orgId)
      .is("parent_id", null);
    if (parentErr) throw parentErr;
    qc.invalidateQueries({ queryKey: ["cost_centers", orgId] });
  };

  const seedDefaultCenters = async () => {
    if (!user || !orgId) throw new Error("Usuário ou organização não definidos");
    const uid = user.id;
    const level1 = [
      { code: "CC-01", name: "Diretoria / Administração Geral" },
      { code: "CC-02", name: "Operações BPO Financeiro" },
      { code: "CC-03", name: "Operações Contabilidade" },
      { code: "CC-04", name: "Operações Licitações" },
      { code: "CC-05", name: "Comercial e Marketing" },
      { code: "CC-06", name: "Recursos Humanos" },
    ];
    const { data: l1Data, error: l1Err } = await supabase
      .from("cost_centers" as any)
      .insert(level1.map((c) => ({ ...c, user_id: uid, organization_id: orgId, parent_id: null, business_unit: "Matriz", responsible: null, description: null, active: true })))
      .select();
    if (l1Err) throw l1Err;
    const l1 = l1Data as unknown as CostCenter[];
    const l1Map = Object.fromEntries(l1.map((c) => [c.code, c.id]));
    const level2 = [
      { code: "CC-01.01", name: "Financeiro Interno", parentCode: "CC-01" },
      { code: "CC-01.02", name: "Jurídico", parentCode: "CC-01" },
      { code: "CC-01.03", name: "TI e Infraestrutura", parentCode: "CC-01" },
      { code: "CC-02.01", name: "Contas a Pagar", parentCode: "CC-02" },
      { code: "CC-02.02", name: "Contas a Receber", parentCode: "CC-02" },
      { code: "CC-02.03", name: "Conciliação Bancária", parentCode: "CC-02" },
      { code: "CC-02.04", name: "Faturamento", parentCode: "CC-02" },
      { code: "CC-03.01", name: "Escrituração Fiscal", parentCode: "CC-03" },
      { code: "CC-03.02", name: "Obrigações Acessórias", parentCode: "CC-03" },
      { code: "CC-03.03", name: "Folha de Pagamento", parentCode: "CC-03" },
      { code: "CC-04.01", name: "Prospecção e Editais", parentCode: "CC-04" },
      { code: "CC-04.02", name: "Elaboração de Propostas", parentCode: "CC-04" },
      { code: "CC-04.03", name: "Acompanhamento de Pregões", parentCode: "CC-04" },
      { code: "CC-05.01", name: "Vendas e Relacionamento", parentCode: "CC-05" },
      { code: "CC-05.02", name: "Marketing Digital", parentCode: "CC-05" },
    ];
    const { error: l2Err } = await supabase
      .from("cost_centers" as any)
      .insert(level2.map(({ parentCode, ...c }) => ({ ...c, user_id: uid, organization_id: orgId, parent_id: l1Map[parentCode], business_unit: "Matriz", responsible: null, description: null, active: true })));
    if (l2Err) throw l2Err;
    qc.invalidateQueries({ queryKey: ["cost_centers", orgId] });
    toast({ title: "Centros de custo padrão criados com sucesso" });
  };

  return {
    costCenters: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    toggleActive,
    remove,
    deleteAll,
    seedDefaultCenters,
  };
}
