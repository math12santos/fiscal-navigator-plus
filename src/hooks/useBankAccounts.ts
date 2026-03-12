import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

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
}

export function useBankAccounts() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["bank_accounts", orgId];

  const { data: bankAccounts = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("nome");
      if (error) throw error;
      return data as unknown as BankAccount[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<BankAccount>) => {
      const { error } = await supabase.from("bank_accounts" as any).insert({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
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
      qc.invalidateQueries({ queryKey: key });
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
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Conta bancária removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { bankAccounts: bankAccounts.filter((b) => b.active), allBankAccounts: bankAccounts, isLoading, create, update, remove };
}
