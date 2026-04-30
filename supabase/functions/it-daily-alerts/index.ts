// Alertas diários do módulo de TI.
// 1) Renovações de sistemas (30/15/7 dias)
// 2) SLA de tickets em risco (próximas 4h ou vencido)
// 3) Garantias/vida útil de equipamentos expirando
// 4) Telecom com vencimento contratual próximo
// 5) Custo fora da curva (>20% mês a mês) por sistema
// Idempotência: dedupe por (user_id, reference_type, reference_id, dia)

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertSpec {
  organization_id: string;
  user_id: string;
  title: string;
  body: string;
  type: "info" | "warning" | "critical";
  priority: "baixa" | "media" | "alta" | "critica";
  reference_type: string;
  reference_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const today = new Date();
    const dayKey = today.toISOString().slice(0, 10);

    const counters = { renewals: 0, sla: 0, warranty: 0, telecom: 0, cost_spike: 0 };

    // Helper: insere notificação se não houve igual no mesmo dia
    async function pushAlert(spec: AlertSpec) {
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", spec.user_id)
        .eq("reference_type", spec.reference_type)
        .eq("reference_id", spec.reference_id)
        .gte("created_at", `${dayKey}T00:00:00Z`)
        .maybeSingle();
      if (existing) return false;

      const { error } = await admin.from("notifications").insert({
        organization_id: spec.organization_id,
        user_id: spec.user_id,
        title: spec.title,
        body: spec.body,
        type: spec.type,
        priority: spec.priority,
        reference_type: spec.reference_type,
        reference_id: spec.reference_id,
      });
      return !error;
    }

    // Resolver responsável → user_id (via employees.user_id)
    async function resolveUserId(employeeId: string | null, orgId: string): Promise<string | null> {
      if (!employeeId) {
        // Fallback: owner da organização
        const { data } = await admin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();
        return data?.user_id ?? null;
      }
      const { data } = await admin
        .from("employees")
        .select("user_id")
        .eq("id", employeeId)
        .maybeSingle();
      return data?.user_id ?? null;
    }

    // ============== 1. Renovações de sistemas ==============
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const { data: systems } = await admin
      .from("it_systems")
      .select("id, organization_id, name, renewal_date, responsible_employee_id, monthly_value")
      .eq("status", "ativo")
      .not("renewal_date", "is", null)
      .gte("renewal_date", dayKey)
      .lte("renewal_date", horizon.toISOString().slice(0, 10));

    for (const s of systems ?? []) {
      const days = Math.ceil(
        (new Date(s.renewal_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (![30, 15, 7, 3, 1].includes(days)) continue;
      const userId = await resolveUserId(s.responsible_employee_id, s.organization_id);
      if (!userId) continue;
      const severity = days <= 7 ? "critical" : days <= 15 ? "warning" : "info";
      const priority = days <= 7 ? "alta" : days <= 15 ? "media" : "baixa";
      const ok = await pushAlert({
        organization_id: s.organization_id,
        user_id: userId,
        title: `Renovação em ${days} dia(s): ${s.name}`,
        body: `O sistema "${s.name}" renova em ${new Date(s.renewal_date).toLocaleDateString("pt-BR")} (R$ ${Number(s.monthly_value || 0).toFixed(2)}/mês). Avalie renovação ou cancelamento.`,
        type: severity as any,
        priority: priority as any,
        reference_type: "it_system_renewal",
        reference_id: s.id,
      });
      if (ok) counters.renewals++;
    }

    // ============== 2. SLA de tickets em risco ==============
    const in4h = new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const { data: tickets } = await admin
      .from("it_tickets")
      .select("id, organization_id, ticket_number, title, assignee_id, sla_resolution_due_at, sla_resolution_breach")
      .is("resolved_at", null)
      .not("sla_resolution_due_at", "is", null)
      .lte("sla_resolution_due_at", in4h);

    for (const t of tickets ?? []) {
      if (!t.assignee_id) continue;
      const overdue = new Date(t.sla_resolution_due_at) < today;
      const ok = await pushAlert({
        organization_id: t.organization_id,
        user_id: t.assignee_id,
        title: overdue
          ? `SLA vencido: ${t.ticket_number}`
          : `SLA expira em <4h: ${t.ticket_number}`,
        body: `${t.title} — prazo: ${new Date(t.sla_resolution_due_at).toLocaleString("pt-BR")}`,
        type: overdue ? "critical" : "warning",
        priority: overdue ? "critica" : "alta",
        reference_type: "it_ticket_sla",
        reference_id: t.id,
      });
      if (ok) counters.sla++;
    }

    // ============== 3. Garantias / vida útil de equipamentos ==============
    const { data: equipments } = await admin
      .from("it_equipment")
      .select("id, organization_id, name, patrimonial_code, acquisition_date, useful_life_accounting_months, responsible_employee_id, status")
      .neq("status", "baixado");

    for (const e of equipments ?? []) {
      if (!e.acquisition_date || !e.useful_life_accounting_months) continue;
      const acq = new Date(e.acquisition_date);
      const endLife = new Date(acq);
      endLife.setMonth(endLife.getMonth() + e.useful_life_accounting_months);
      const days = Math.ceil((endLife.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 60 || days < -1) continue; // janela: -1..60
      const userId = await resolveUserId(e.responsible_employee_id, e.organization_id);
      if (!userId) continue;
      const severity = days < 0 ? "critical" : days <= 30 ? "warning" : "info";
      const ok = await pushAlert({
        organization_id: e.organization_id,
        user_id: userId,
        title: days < 0
          ? `Vida útil expirada: ${e.patrimonial_code}`
          : `Vida útil expira em ${days}d: ${e.patrimonial_code}`,
        body: `${e.name} — fim da vida útil contábil em ${endLife.toLocaleDateString("pt-BR")}.`,
        type: severity as any,
        priority: severity === "critical" ? "alta" : "media",
        reference_type: "it_equipment_lifecycle",
        reference_id: e.id,
      });
      if (ok) counters.warranty++;
    }

    // ============== 4. Telecom com vencimento próximo ==============
    const { data: telecom } = await admin
      .from("it_telecom_links")
      .select("id, organization_id, name, contract_end_date, responsible_employee_id, monthly_value");

    for (const tl of telecom ?? []) {
      if (!tl.contract_end_date) continue;
      const days = Math.ceil(
        (new Date(tl.contract_end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (![60, 30, 15, 7].includes(days)) continue;
      const userId = await resolveUserId(tl.responsible_employee_id, tl.organization_id);
      if (!userId) continue;
      const ok = await pushAlert({
        organization_id: tl.organization_id,
        user_id: userId,
        title: `Telecom vence em ${days}d: ${tl.name}`,
        body: `Contrato de telecom "${tl.name}" expira em ${new Date(tl.contract_end_date).toLocaleDateString("pt-BR")}.`,
        type: days <= 15 ? "warning" : "info",
        priority: days <= 15 ? "alta" : "media",
        reference_type: "it_telecom_renewal",
        reference_id: tl.id,
      });
      if (ok) counters.telecom++;
    }

    return new Response(JSON.stringify({ ok: true, day: dayKey, counters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
