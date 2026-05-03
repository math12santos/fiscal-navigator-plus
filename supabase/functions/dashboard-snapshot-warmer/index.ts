// Pre-warms public.dashboard_snapshots for active organizations.
// Triggered every 3 hours by pg_cron so the first user of the day
// never waits for a recompute.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const started = Date.now();
  let processed = 0;
  let failed = 0;

  try {
    const { data: orgs, error: listErr } = await admin.rpc("list_orgs_for_snapshot_warmup");
    if (listErr) throw listErr;

    for (const row of (orgs ?? []) as Array<{ organization_id: string; reference_month: string }>) {
      const { error: rpcErr } = await admin.rpc("recompute_dashboard_snapshot", {
        _organization_id: row.organization_id,
        _reference_month: row.reference_month,
      });
      if (rpcErr) {
        failed += 1;
      } else {
        processed += 1;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        failed,
        elapsed_ms: Date.now() - started,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, processed, failed }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
