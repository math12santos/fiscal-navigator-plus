import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RequestComment {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export function useRequestComments(requestId?: string) {
  return useQuery({
    queryKey: ["request_comments", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_comments" as any)
        .select("*")
        .eq("request_id", requestId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RequestComment[];
    },
    enabled: !!requestId,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
      const { error } = await supabase.from("request_comments" as any).insert({
        request_id: requestId,
        user_id: user!.id,
        content,
        type: "comment",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request_comments"] });
    },
  });
}
