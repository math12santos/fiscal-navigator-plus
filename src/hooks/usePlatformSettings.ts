import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformSetting {
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings" as any)
        .select("*")
        .order("key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlatformSetting[];
    },
    staleTime: 60 * 1000,
  });
}

export function useUpsertPlatformSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; value: any; description?: string }) => {
      const { error } = await supabase
        .from("platform_settings" as any)
        .upsert({ key: input.key, value: input.value, description: input.description ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform_settings"] }),
  });
}

export interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body_html: string;
  variables: string[];
  is_active: boolean;
  updated_at: string;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates" as any)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EmailTemplate[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; subject: string; body_html: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("email_templates" as any)
        .update({ subject: input.subject, body_html: input.body_html, is_active: input.is_active })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function usePurgeAuditLogs() {
  return useMutation({
    mutationFn: async (days: number) => {
      const { data, error } = await supabase.rpc("purge_old_audit_logs" as any, { _days: days });
      if (error) throw error;
      return data as unknown as number;
    },
  });
}
