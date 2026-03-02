import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!SLACK_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "SLACK_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action, params } = body as { action: string; params?: Record<string, unknown> };

    const gatewayHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    let data: unknown;

    switch (action) {
      case "channels.list": {
        const res = await fetch(`${GATEWAY_URL}/conversations.list`, {
          method: "POST",
          headers: gatewayHeaders,
          body: JSON.stringify({
            types: "public_channel,private_channel",
            exclude_archived: true,
            limit: 200,
            ...(params || {}),
          }),
        });
        data = await res.json();
        break;
      }

      case "channels.history": {
        const res = await fetch(`${GATEWAY_URL}/conversations.history`, {
          method: "POST",
          headers: gatewayHeaders,
          body: JSON.stringify({
            channel: params?.channel,
            limit: params?.limit || 50,
            ...(params?.oldest ? { oldest: params.oldest } : {}),
          }),
        });
        data = await res.json();
        break;
      }

      case "chat.postMessage": {
        const res = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
          method: "POST",
          headers: gatewayHeaders,
          body: JSON.stringify({
            channel: params?.channel,
            text: params?.text,
            ...(params?.username ? { username: params.username } : {}),
            ...(params?.icon_emoji ? { icon_emoji: params.icon_emoji } : {}),
          }),
        });
        data = await res.json();
        break;
      }

      case "channels.replies": {
        const res = await fetch(`${GATEWAY_URL}/conversations.replies`, {
          method: "POST",
          headers: gatewayHeaders,
          body: JSON.stringify({
            channel: params?.channel,
            ts: params?.ts,
            limit: params?.limit || 50,
          }),
        });
        data = await res.json();
        break;
      }

      default:
        return new Response(
          JSON.stringify({ ok: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Slack proxy error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
