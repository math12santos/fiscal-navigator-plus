import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useUserDataScope } from "@/hooks/useUserDataScope";
import { useHolding } from "@/contexts/HoldingContext";

export interface Contract {
  id: string;
  entity_id: string | null;
  product_id: string | null;
  nome: string;
  tipo: string;
  valor: number;
  vencimento: string;
  status: string;
  source: string;
  external_ref: string | null;
  notes: string | null;
  created_at: string;
  tipo_recorrencia: string;
  intervalo_personalizado: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  prazo_indeterminado: boolean;
  valor_base: number;
  dia_vencimento: number | null;
  tipo_reajuste: string | null;
  indice_reajuste: string | null;
  percentual_reajuste: number | null;
  periodicidade_reajuste: string | null;
  proximo_reajuste: string | null;
  natureza_financeira: string | null;
  impacto_resultado: string | null;
  cost_center_id: string | null;
  responsavel_interno: string | null;
  area_responsavel: string | null;
  sla_revisao_dias: number | null;
  finalidade: string | null;
  operacao: string | null;
  subtipo_operacao: string | null;
  rendimento_mensal_esperado: number | null;
  organization_id?: string | null;
}

export type ContractInput = Omit<Contract, "id" | "source" | "external_ref" | "created_at" | "organization_id">;

export function useContracts() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;
  const { holdingMode, activeOrgIds } = useHolding();

  const query = useQuery({
    queryKey: ["contracts", holdingMode ? activeOrgIds : orgId],
    queryFn: async () => {
      let q = supabase
        .from("contracts")
        .select("*")
        .order("vencimento", { ascending: true });
      if (holdingMode && activeOrgIds.length > 0) {
        q = q.in("organization_id", activeOrgIds);
      } else if (orgId) {
        q = q.eq("organization_id", orgId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Contract[];
    },
    enabled: !!user && !!orgId,
  });

  const sanitizeInput = (data: Record<string, any>) => {
    const dateFields = ["data_inicio", "data_fim", "proximo_reajuste", "vencimento"];
    const uuidFields = ["entity_id", "product_id", "cost_center_id", "organization_id"];
    const sanitized = { ...data };
    // Convert empty strings to null for date and uuid fields
    for (const field of [...dateFields, ...uuidFields]) {
      if (sanitized[field] === "") sanitized[field] = null;
    }
    // Also catch any other field that looks like an empty string going to a uuid column
    const allPossibleUuidKeys = Object.keys(sanitized).filter(k => k.endsWith("_id"));
    for (const field of allPossibleUuidKeys) {
      if (sanitized[field] === "") sanitized[field] = null;
    }
    // For non-indefinite contracts, fallback vencimento to data_fim
    if (!sanitized.vencimento && !sanitized.prazo_indeterminado) {
      sanitized.vencimento = sanitized.data_fim || sanitized.data_inicio || null;
    }
    return sanitized;
  };

  const create = useMutation({
    mutationFn: async (c: ContractInput) => {
      const { error } = await supabase.from("contracts").insert(sanitizeInput({
        ...c,
        user_id: user!.id,
        organization_id: orgId,
        source: "manual",
      }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts", orgId] });
      toast({ title: "Contrato criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...c }: { id: string } & Partial<ContractInput>) => {
      const { error } = await supabase.from("contracts").update(sanitizeInput(c) as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts", orgId] });
      toast({ title: "Contrato atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts", orgId] });
      toast({ title: "Contrato removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const { filterByScope } = useUserDataScope();
  const contracts = useMemo(() => filterByScope(query.data ?? []), [query.data, filterByScope]);

  return { contracts, isLoading: query.isLoading, create, update, remove };
}
