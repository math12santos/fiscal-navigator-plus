import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SecurityEvent {
  id: string;
  user_id: string | null;
  email: string | null;
  event_type: string;
  user_agent: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useSecurityEvents() {
  return useQuery({
    queryKey: ["security_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SecurityEvent[];
    },
  });
}
