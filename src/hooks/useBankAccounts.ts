import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useHolding } from "@/contexts/HoldingContext";

export interface BankAccount {
  id: string;
  organization_id: string | null;
  user_id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string;
  pix_key: string | null;
  active: boolean;
  created_at: string;
  saldo_atual: number;
  saldo_atualizado_em: string | null;
  saldo_atualizado_por: string | null;
  limite_credito: number;
  limite_tipo: string | null;
  limite_taxa_juros_mensal: number | null;
  limite_utilizado: number | null;
  limite_vencimento: string | null;
  limite_atualizado_em: string | null;
  limite_atualizado_por: string | null;
}

export function useBankAccounts() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const { holdingMode, activeOrgIds } = useHolding();
  const key = ["bank_accounts", holdingMode ? activeOrgIds : orgId];

  const { data: bankAccounts = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
    queryFn: async () => {
      let q = supabase
        .from("bank_accounts" as any)
        .select("*")
        .order("nome");

      if (holdingMode && activeOrgIds.length > 0) {
        q = q.in("organization_id", activeOrgIds);
      } else if (orgId) {
        q = q.eq("organization_id", orgId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as BankAccount[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<BankAccount>) => {
      // Use provided organization_id (for holding creating in subsidiary) or default to current
      const targetOrgId = input.organization_id || orgId;
      const { error } = await supabase.from("bank_accounts" as any).insert({
        ...input,
        user_id: user!.id,
        organization_id: targetOrgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast({ title: "Conta bancária cadastrada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<BankAccount> & { id: string }) => {
      const { error } = await supabase.from("bank_accounts" as any).update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast({ title: "Conta bancária atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast({ title: "Conta bancária removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { bankAccounts: bankAccounts.filter((b) => b.active), allBankAccounts: bankAccounts, isLoading, create, update, remove };
}
