// Alertas de maturidade do DP — roda diariamente via pg_cron.
// 1) Cria notificações para gestores quando há itens de "atualização" críticos
//    ou quando rotinas estão abaixo da meta (dp_config.meta_rotinas_pct).
// 2) Cria notificações para colaboradores com rotinas DP atrasadas.
// Idempotência: dedupe por (user_id, reference_id, dia).

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChecklistItem {
  key: string;
  label: string;
  category: string;
  weight: number;
  earned: number;
  detail?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const today = new Date();
    const dayKey = today.toISOString().slice(0, 10);
    const todayIso = today.toISOString().slice(0, 10);
    let notificationsCreated = 0;

    // ============== A. ALERTAS POR ORG (gestores) ==============
    const { data: maturityRows, error: maturityErr } = await admin
      .from("sector_onboarding")
      .select("organization_id, sector, score, routines_score, checklist, maturity_label")
      .eq("sector", "dp");

    if (maturityErr) throw maturityErr;

    for (const row of maturityRows ?? []) {
      const orgId = row.organization_id as string;
      const checklist: ChecklistItem[] = Array.isArray(row.checklist) ? row.checklist : [];

      // Meta de rotinas da org — preferir sector_maturity_targets, fallback dp_config (legado), default 0.85
      const { data: targetsRow } = await admin
        .from("sector_maturity_targets")
        .select("routines_target_pct")
        .eq("organization_id", orgId)
        .eq("sector", "dp")
        .maybeSingle();
      let meta = Number(targetsRow?.routines_target_pct ?? NaN);
      if (!Number.isFinite(meta)) {
        const { data: cfg } = await admin
          .from("dp_config")
          .select("meta_rotinas_pct")
          .eq("organization_id", orgId)
          .maybeSingle();
        meta = Number(cfg?.meta_rotinas_pct ?? 0.85);
      }

      // Itens críticos de atualização (vencidos ou folha não fechada)
      const criticalUpdate = checklist.filter(
        (i) =>
          i.category === "atualizacao" &&
          i.earned < i.weight * 0.5 &&
          (
            (i.detail || "").toLowerCase().includes("vencido") ||
            (i.detail || "").toLowerCase().includes("não encontrada") ||
            (i.detail || "").toLowerCase().includes("status:")
          )
      );

      const routinesPct = Number(row.routines_score ?? 0) / 25;
      const routinesBelowMeta = routinesPct < meta;

      if (criticalUpdate.length === 0 && !routinesBelowMeta) continue;

      // Identifica gestores: owner/admin da org + responsáveis com permissão dp.config
      const { data: members } = await admin
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .in("role", ["owner", "admin"]);

      const managerIds = new Set<string>((members ?? []).map((m: any) => m.user_id));

      // Soma também usuários com permissão dp.config
      const { data: perms } = await admin
        .from("user_permissions")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("module", "dp")
        .eq("tab", "config")
        .eq("allowed", true);
      for (const p of perms ?? []) managerIds.add(p.user_id);

      for (const uid of managerIds) {
        const refId = `dp-maturity:${orgId}:${dayKey}`;

        // Idempotência: já tem notificação hoje para esse user/ref?
        const { data: existing } = await admin
          .from("notifications")
          .select("id")
          .eq("user_id", uid)
          .eq("reference_type", "sector_onboarding")
          .eq("reference_id", refId)
          .limit(1);
        if (existing && existing.length > 0) continue;

        const parts: string[] = [];
        if (criticalUpdate.length > 0) {
          parts.push(`${criticalUpdate.length} item(ns) de atualização atrasados`);
        }
        if (routinesBelowMeta) {
          parts.push(
            `cumprimento de rotinas em ${Math.round(routinesPct * 100)}% (meta ${Math.round(meta * 100)}%)`
          );
        }

        await admin.from("notifications").insert({
          organization_id: orgId,
          user_id: uid,
          title: "Maturidade do DP precisa de atenção",
          body: parts.join(" • "),
          type: "dp_maturity",
          priority: routinesBelowMeta ? "alta" : "media",
          reference_type: "sector_onboarding",
          reference_id: refId,
        });
        notificationsCreated++;
      }
    }

    // ============== B. ALERTAS POR ROTINA ATRASADA (colaboradores) ==============
    const { data: overdue } = await admin
      .from("requests")
      .select("id, organization_id, assigned_to, title, due_date, status")
      .eq("type", "rotina_dp")
      .lt("due_date", todayIso)
      .not("assigned_to", "is", null)
      .not("status", "in", "(concluida,concluído,cancelada)");

    for (const r of overdue ?? []) {
      const refId = `rotina-overdue:${r.id}:${dayKey}`;
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", r.assigned_to)
        .eq("reference_type", "request")
        .eq("reference_id", refId)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const daysLate = Math.max(
        1,
        Math.floor((today.getTime() - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24))
      );

      await admin.from("notifications").insert({
        organization_id: r.organization_id,
        user_id: r.assigned_to,
        title: "Rotina DP atrasada",
        body: `${r.title} — ${daysLate} dia(s) em atraso`,
        type: "dp_routine_overdue",
        priority: daysLate > 3 ? "alta" : "media",
        reference_type: "request",
        reference_id: refId,
      });
      notificationsCreated++;
    }

    return new Response(
      JSON.stringify({ ok: true, notificationsCreated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
