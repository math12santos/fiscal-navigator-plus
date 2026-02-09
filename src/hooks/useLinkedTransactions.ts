import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LinkedTransactionsResult {
  has_linked_transactions: boolean;
  account_references: number;
  cost_center_references: number;
  details: Record<string, unknown>;
}

export function useLinkedTransactions() {
  const { user } = useAuth();

  const checkLinkedTransactions = async (): Promise<LinkedTransactionsResult> => {
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase.rpc("check_linked_transactions", {
      p_user_id: user.id,
    });

    if (error) throw error;

    return data as unknown as LinkedTransactionsResult;
  };

  return { checkLinkedTransactions };
}
