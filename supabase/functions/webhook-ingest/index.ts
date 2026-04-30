// Webhook Ingest — recebe eventos de ERPs externos e materializa em cashflow_entries.
// Autenticação: header `X-Webhook-Token` (compare hash sha256 com integration_endpoints.secret_hash).
// Idempotência: UNIQUE(endpoint_id, external_id) em integration_events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PayloadSchema = z.object({
  external_id: z.string().min(1).max(255),
  event_type: z.string().min(1).max(100).optional().default("cashflow.create"),
  data: z.object({
    descricao: z.string().min(1).max(500),
    valor: z.number().positive(),
    tipo: z.enum(["pagar", "receber"]),
    data_prevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    data_realizada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    status: z.enum(["previsto", "confirmado", "pago", "recebido"]).optional().default("previsto"),
    documento: z.string().max(100).optional().nullable(),
    competencia: z.string().max(20).optional().nullable(),
    favorecido: z.string().max(255).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  }),
});

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Endpoint identifier via query (?endpoint=<uuid>) ou path
  const url = new URL(req.url);
  const endpointId = url.searchParams.get("endpoint");
  const token = req.headers.get("x-webhook-token");

  if (!endpointId || !token) {
    return new Response(JSON.stringify({ error: "Missing endpoint or token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenHash = await sha256Hex(token);
  const { data: endpoint, error: epErr } = await supabase
    .from("integration_endpoints")
    .select("*")
    .eq("id", endpointId)
    .eq("active", true)
    .maybeSingle();

  if (epErr || !endpoint || endpoint.secret_hash !== tokenHash) {
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate payload
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const { external_id, event_type, data } = parsed.data;

  // Idempotência: tenta inserir o evento; se duplicar (unique), retorna 200 com flag
  const { data: existing } = await supabase
    .from("integration_events")
    .select("id, status, cashflow_entry_id")
    .eq("endpoint_id", endpoint.id)
    .eq("external_id", external_id)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({
        ok: true,
        duplicate: true,
        event_id: existing.id,
        cashflow_entry_id: existing.cashflow_entry_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Cria evento (status received) e materializa cashflow_entry
  const { data: eventRow, error: evErr } = await supabase
    .from("integration_events")
    .insert({
      organization_id: endpoint.organization_id,
      endpoint_id: endpoint.id,
      external_id,
      event_type,
      raw_payload: body as Record<string, unknown>,
      status: "received",
    })
    .select()
    .single();

  if (evErr) {
    return new Response(JSON.stringify({ error: "Failed to log event", details: evErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Insere cashflow_entry usando defaults do endpoint
  const { data: cf, error: cfErr } = await supabase
    .from("cashflow_entries")
    .insert({
      organization_id: endpoint.organization_id,
      user_id: endpoint.user_id,
      descricao: data.descricao,
      tipo: data.tipo,
      valor_previsto: data.valor,
      valor_realizado: data.status === "pago" || data.status === "recebido" ? data.valor : null,
      data_prevista: data.data_prevista,
      data_realizada: data.data_realizada ?? null,
      status: data.status,
      documento: data.documento ?? null,
      competencia: data.competencia ?? null,
      favorecido: data.favorecido ?? null,
      notes: `[webhook:${endpoint.provider}] ${data.notes ?? ""}`.trim(),
      account_id: endpoint.default_account_id,
      cost_center_id: endpoint.default_cost_center_id,
      conta_bancaria_id: endpoint.default_bank_account_id,
      source: "webhook",
      source_ref: `${endpoint.provider}:${external_id}`,
    })
    .select("id")
    .single();

  if (cfErr) {
    await supabase
      .from("integration_events")
      .update({ status: "error", error_message: cfErr.message, processed_at: new Date().toISOString() })
      .eq("id", eventRow.id);
    return new Response(
      JSON.stringify({ error: "Failed to create cashflow entry", details: cfErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  await supabase
    .from("integration_events")
    .update({
      status: "processed",
      cashflow_entry_id: cf.id,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventRow.id);

  await supabase
    .from("integration_endpoints")
    .update({
      last_received_at: new Date().toISOString(),
      events_count: (endpoint.events_count ?? 0) + 1,
    })
    .eq("id", endpoint.id);

  return new Response(
    JSON.stringify({ ok: true, event_id: eventRow.id, cashflow_entry_id: cf.id }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
