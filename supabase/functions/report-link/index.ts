// Resolve um signed_token em redirect para o PDF assinado.
// Registra link_opened_at na primeira abertura.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    if (!token) {
      return new Response("Token ausente", { status: 400, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: run } = await supabase
      .from("report_runs")
      .select("id, organization_id, pdf_path, expires_at")
      .eq("signed_token", token)
      .maybeSingle();

    if (!run) return new Response("Token inválido", { status: 404, headers: corsHeaders });
    if (run.expires_at && new Date(run.expires_at) < new Date()) {
      return new Response("Link expirado", { status: 410, headers: corsHeaders });
    }

    // Marca link_opened nos deliveries vinculados ainda não abertos
    await supabase
      .from("report_deliveries")
      .update({ link_opened_at: new Date().toISOString(), status: "read" })
      .eq("run_id", run.id)
      .is("link_opened_at", null);

    const { data: signed } = await supabase.storage.from("reports").createSignedUrl(run.pdf_path!, 3600);
    if (!signed?.signedUrl) return new Response("Falha ao assinar", { status: 500, headers: corsHeaders });

    return Response.redirect(signed.signedUrl, 302);
  } catch (e: any) {
    return new Response(`Erro: ${e?.message ?? e}`, { status: 500, headers: corsHeaders });
  }
});
