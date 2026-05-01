import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string | null;
  severity: "info" | "success" | "warning" | "critical";
  audience: "all" | "plan" | "org";
  plan_id: string | null;
  organization_id: string | null;
  starts_at: string;
  ends_at: string | null;
  dismissible: boolean;
  cta_label: string | null;
  cta_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const DISMISSED_KEY = "lovable.announcements.dismissed";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function dismissAnnouncement(id: string) {
  const list = getDismissed();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(list));
  }
}

/** All announcements (BackOffice management view). */
export function useAllAnnouncements() {
  return useQuery({
    queryKey: ["platform_announcements", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_announcements" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlatformAnnouncement[];
    },
    staleTime: 60 * 1000,
  });
}

/** Active announcements visible to the current org (consumer view). */
export function useActiveAnnouncements() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["platform_announcements", "active", currentOrg?.id],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("platform_announcements" as any)
        .select("*")
        .lte("starts_at", nowIso)
        .order("starts_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      const list = (data ?? []) as unknown as PlatformAnnouncement[];
      const dismissed = new Set(getDismissed());
      return list.filter((a) => {
        if (a.ends_at && new Date(a.ends_at) < new Date()) return false;
        if (a.audience === "org" && a.organization_id !== currentOrg?.id) return false;
        // 'plan' audience filtering would require subscription join — skipped for now
        if (dismissed.has(a.id) && a.dismissible) return false;
        return true;
      });
    },
    staleTime: 60 * 1000,
  });
}

export function useUpsertAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PlatformAnnouncement> & { title: string }) => {
      const payload: any = {
        title: input.title,
        body: input.body ?? null,
        severity: input.severity ?? "info",
        audience: input.audience ?? "all",
        plan_id: input.plan_id ?? null,
        organization_id: input.organization_id ?? null,
        starts_at: input.starts_at ?? new Date().toISOString(),
        ends_at: input.ends_at ?? null,
        dismissible: input.dismissible ?? true,
        cta_label: input.cta_label ?? null,
        cta_url: input.cta_url ?? null,
      };
      if (input.id) {
        const { error } = await supabase
          .from("platform_announcements" as any)
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("platform_announcements" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform_announcements"] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_announcements" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform_announcements"] }),
  });
}
