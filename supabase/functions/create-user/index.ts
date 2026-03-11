import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://fiscal-navigator-plus.lovable.app",
  "https://id-preview--ece8afb2-d341-4ecc-a784-440fb64e75ca.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Credentials": "true",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { email, password, full_name, cargo, organization_ids, roles } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check authorization: master role OR owner/admin in at least one target org
    const { data: masterRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "master")
      .maybeSingle();

    let authorized = !!masterRole;

    if (!authorized && organization_ids && organization_ids.length > 0) {
      const targetOrgIds = organization_ids.map((o: { id: string }) => o.id);
      const { data: callerMemberships } = await adminClient
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", caller.id)
        .in("organization_id", targetOrgIds)
        .in("role", ["owner", "admin"]);

      if (callerMemberships && callerMemberships.length > 0) {
        // Caller must be owner/admin in ALL target orgs
        const authorizedOrgIds = new Set(callerMemberships.map((m: any) => m.organization_id));
        authorized = targetOrgIds.every((id: string) => authorizedOrgIds.has(id));
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Acesso negado: permissão insuficiente" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user via admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "" },
    });

    if (createError) {
      console.error("[create-user] Error:", createError);
      let userMessage = "Não foi possível criar o usuário";
      if (createError.message?.includes("duplicate") || createError.message?.includes("already")) {
        userMessage = "Este e-mail já está em uso";
      } else if (createError.message?.includes("invalid")) {
        userMessage = "Dados inválidos fornecidos";
      }
      return new Response(JSON.stringify({ error: userMessage }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = newUser.user.id;

    // Update profile
    const profileUpdate: Record<string, unknown> = { must_change_password: true, email };
    if (full_name) profileUpdate.full_name = full_name;
    if (cargo) profileUpdate.cargo = cargo;

    await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    // Add to organizations
    if (organization_ids && organization_ids.length > 0) {
      const memberships = organization_ids.map((org: { id: string; role: string }) => ({
        user_id: userId,
        organization_id: org.id,
        role: org.role || "member",
      }));
      await adminClient.from("organization_members").insert(memberships);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-user] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
