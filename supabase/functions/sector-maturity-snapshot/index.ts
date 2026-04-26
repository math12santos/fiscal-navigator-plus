// Snapshot mensal da maturidade — roda no dia 1 de cada mês via pg_cron.
// Faz upsert em sector_onboarding_history com period_month = mês ANTERIOR
// (capturando o estado consolidado ao fim do mês).

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Mês anterior, dia 1
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: rows, error } = await admin
      .from("sector_onboarding")
      .select("*");
    if (error) throw error;

    let saved = 0;
    for (const r of rows ?? []) {
      const { error: upErr } = await admin
        .from("sector_onboarding_history")
        .upsert(
          {
            organization_id: r.organization_id,
            sector: r.sector,
            period_month: periodMonth,
            score: r.score,
            completeness_score: r.completeness_score,
            freshness_score: r.freshness_score,
            routines_score: r.routines_score,
            maturity_label: r.maturity_label,
            checklist: r.checklist,
            snapshot_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,sector,period_month" }
        );
      if (!upErr) saved++;
    }

    return new Response(
      JSON.stringify({ ok: true, periodMonth, saved }),
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
