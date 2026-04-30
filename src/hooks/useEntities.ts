import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface Entity {
  id: string;
  organization_id: string | null;
  user_id: string;
  type: string;
  name: string;
  document_type: string | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  payment_condition: string | null;
  credit_limit: number | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_pix: string | null;
  notes: string | null;
  tags: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type EntityInsert = Omit<Entity, "id" | "created_at" | "updated_at"> & { id?: string };

export function useEntities() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["entities", orgId];

  const { data: entities = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user && !!orgId,
    ...cachePresets.reference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return data as Entity[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<EntityInsert>) => {
      const { error } = await supabase.from("entities").insert({
        ...input,
        user_id: user!.id,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: "Cadastro criado" }); },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async (input: Partial<EntityInsert> & { id: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from("entities").update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: "Cadastro atualizado" }); },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("entities").update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: "Cadastro removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return { entities, isLoading, create, update, toggleActive, remove };
}
