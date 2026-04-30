import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface PaymentMethod {
  id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  active: boolean;
  is_default: boolean;
  created_at: string;
}

const DEFAULT_METHODS = ["PIX", "Boleto", "TED", "Cartão de Crédito", "Cartão de Débito", "Débito Automático"];

export function usePaymentMethods() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["payment_methods", orgId];

  const { data: methods = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return data as unknown as PaymentMethod[];
    },
  });

  // Return default labels merged with custom ones
  const allMethods = (() => {
    const custom = methods.filter((m) => m.active).map((m) => m.name);
    const all = [...new Set([...DEFAULT_METHODS, ...custom])];
    return all;
  })();

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("payment_methods" as any).insert({
        name,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Forma de pagamento criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { methods: allMethods, isLoading, create };
}
