import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface Product {
  id: string;
  organization_id: string | null;
  user_id: string;
  code: string;
  name: string;
  type: string;
  unit: string | null;
  unit_price: number;
  category: string | null;
  description: string | null;
  ncm: string | null;
  cest: string | null;
  account_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductInsert = Omit<Product, "id" | "created_at" | "updated_at"> & { id?: string };

export function useProducts() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["products", orgId];

  const { data: products = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", orgId!)
        .order("code");
      if (error) throw error;
      return data as Product[];
    },
  });

  const sanitizeUuids = (data: Record<string, any>) => {
    const sanitized = { ...data };
    for (const key of Object.keys(sanitized)) {
      if (key.endsWith("_id") && sanitized[key] === "") sanitized[key] = null;
    }
    return sanitized;
  };

  const create = useMutation({
    mutationFn: async (input: Partial<ProductInsert>) => {
      const { error } = await supabase.from("products").insert(sanitizeUuids({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      }) as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: "Produto criado" }); },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async (input: Partial<ProductInsert> & { id: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from("products").update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: "Produto atualizado" }); },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: "Produto removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return { products, isLoading, create, update, toggleActive, remove };
}
