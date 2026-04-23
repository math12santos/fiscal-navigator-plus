// Camada 1 — Gerador de Relatórios
// Recebe { template_code, organization_id, period?, schedule_id?, trigger_source? }
// Gera payload JSON + PDF (texto simples por enquanto), salva no bucket "reports",
// cria report_run com signed_token e devolve { run_id, signed_url, payload }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  template_code: string;
  organization_id: string;
  schedule_id?: string;
  trigger_source?: "cron" | "manual" | "event" | "escalation";
  period?: { start?: string; end?: string };
}

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

function maskBand(n: number) {
  const abs = Math.abs(n);
  if (abs < 10_000) return "< R$ 10k";
  if (abs < 100_000) return "R$ 10k–100k";
  if (abs < 500_000) return "R$ 100k–500k";
  if (abs < 1_000_000) return "R$ 500k–1M";
  if (abs < 5_000_000) return "R$ 1M–5M";
  return "> R$ 5M";
}

async function buildPayload(supabase: any, templateCode: string, orgId: string) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const in7d = new Date(today.getTime() + 7 * 86_400_000);
  const in30d = new Date(today.getTime() + 30 * 86_400_000);
  const in60d = new Date(today.getTime() + 60 * 86_400_000);
  const iso = (d: Date) => d.toISOString().split("T")[0];

  const sections: Array<{ title: string; lines: string[]; values?: Record<string, number> }> = [];

  switch (templateCode) {
    case "daily_cash_summary":
    case "daily_treasury": {
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("nome, banco, saldo_atual, limite_credito, limite_utilizado, limite_tipo")
        .eq("organization_id", orgId)
        .eq("active", true);

      const totalSaldo = (accounts || []).reduce((s: number, a: any) => s + (Number(a.saldo_atual) || 0), 0);
      const totalLimite = (accounts || []).reduce(
        (s: number, a: any) => s + (Number(a.limite_credito) || 0) - (Number(a.limite_utilizado) || 0),
        0,
      );

      sections.push({
        title: "Posição Bancária",
        lines: (accounts || []).map(
          (a: any) => `${a.nome} (${a.banco ?? "—"}): ${brl(Number(a.saldo_atual) || 0)}`,
        ),
        values: { total_saldo: totalSaldo, limite_disponivel: totalLimite },
      });

      const { data: paid } = await supabase
        .from("cashflow_entries")
        .select("descricao, valor_realizado, valor_previsto")
        .eq("organization_id", orgId)
        .eq("status", "realizado")
        .gte("data_realizada", iso(yesterday))
        .lte("data_realizada", iso(yesterday));

      const totalPago = (paid || []).reduce(
        (s: number, e: any) => s + Math.abs(Number(e.valor_realizado || e.valor_previsto) || 0),
        0,
      );
      sections.push({
        title: `Movimentações de ${iso(yesterday)}`,
        lines: [`Total realizado: ${brl(totalPago)}`, `Lançamentos: ${(paid || []).length}`],
        values: { total_realizado: totalPago },
      });

      const { data: vencer } = await supabase
        .from("cashflow_entries")
        .select("descricao, valor_previsto, data_vencimento, tipo")
        .eq("organization_id", orgId)
        .neq("status", "realizado")
        .gte("data_vencimento", iso(today))
        .lte("data_vencimento", iso(in7d));

      const totalVencer = (vencer || []).reduce(
        (s: number, e: any) => s + Math.abs(Number(e.valor_previsto) || 0),
        0,
      );
      sections.push({
        title: "A Vencer (próximos 7 dias)",
        lines: [`${(vencer || []).length} lançamentos · Total: ${brl(totalVencer)}`],
        values: { total_a_vencer_7d: totalVencer },
      });
      break;
    }

    case "weekly_executive": {
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("saldo_atual")
        .eq("organization_id", orgId)
        .eq("active", true);
      const caixa = (accounts || []).reduce((s: number, a: any) => s + (Number(a.saldo_atual) || 0), 0);

      const { data: contratos } = await supabase
        .from("contracts")
        .select("nome, valor, data_fim, tipo")
        .eq("organization_id", orgId)
        .eq("status", "ativo")
        .lte("data_fim", iso(in60d));

      sections.push({
        title: "Caixa Consolidado",
        lines: [`Saldo total: ${brl(caixa)}`],
        values: { caixa_consolidado: caixa },
      });
      sections.push({
        title: "Contratos Críticos (vencimento ≤ 60d)",
        lines: (contratos || []).slice(0, 10).map((c: any) => `${c.nome} · ${brl(Number(c.valor) || 0)} · vence ${c.data_fim}`),
      });
      break;
    }

    case "exception_alerts": {
      const { data: lowSaldo } = await supabase
        .from("bank_accounts")
        .select("nome, saldo_atual")
        .eq("organization_id", orgId)
        .eq("active", true)
        .lt("saldo_atual", 0);

      const { data: semClassif } = await supabase
        .from("cashflow_entries")
        .select("id", { count: "exact", head: false })
        .eq("organization_id", orgId)
        .is("account_id", null)
        .limit(50);

      sections.push({
        title: "Saldos Negativos",
        lines: (lowSaldo || []).map((a: any) => `${a.nome}: ${brl(Number(a.saldo_atual) || 0)}`),
        values: { contas_negativas: (lowSaldo || []).length },
      });
      sections.push({
        title: "Despesas sem Classificação",
        lines: [`${(semClassif || []).length} lançamentos pendentes`],
        values: { despesas_sem_classif: (semClassif || []).length },
      });
      break;
    }

    case "monthly_closing": {
      const { data: aging } = await supabase
        .from("cashflow_entries")
        .select("tipo, valor_previsto, data_vencimento")
        .eq("organization_id", orgId)
        .neq("status", "realizado");

      const ap = (aging || []).filter((e: any) => e.tipo === "despesa");
      const ar = (aging || []).filter((e: any) => e.tipo === "receita");
      const sumAp = ap.reduce((s: number, e: any) => s + Math.abs(Number(e.valor_previsto) || 0), 0);
      const sumAr = ar.reduce((s: number, e: any) => s + (Number(e.valor_previsto) || 0), 0);

      sections.push({
        title: "Fechamento Consolidado",
        lines: [
          `Contas a Pagar (em aberto): ${brl(sumAp)}`,
          `Contas a Receber (em aberto): ${brl(sumAr)}`,
          `Saldo líquido projetado: ${brl(sumAr - sumAp)}`,
        ],
        values: { ap_total: sumAp, ar_total: sumAr, liquido: sumAr - sumAp },
      });
      break;
    }

    case "weekly_aging": {
      const { data: aging } = await supabase
        .from("cashflow_entries")
        .select("descricao, tipo, valor_previsto, data_vencimento")
        .eq("organization_id", orgId)
        .neq("status", "realizado")
        .lte("data_vencimento", iso(in30d))
        .order("data_vencimento", { ascending: true })
        .limit(20);

      sections.push({
        title: "Top 20 Aging (próximos 30d)",
        lines: (aging || []).map(
          (e: any) =>
            `${e.data_vencimento} · ${e.tipo} · ${e.descricao?.slice(0, 40)} · ${brl(Number(e.valor_previsto) || 0)}`,
        ),
      });
      break;
    }
  }

  return {
    template_code: templateCode,
    organization_id: orgId,
    generated_at: new Date().toISOString(),
    sections,
  };
}

function renderTextReport(payload: any, orgName: string, mask: boolean) {
  const lines: string[] = [];
  lines.push(`COLLI FINCORE — Relatório`);
  lines.push(`Empresa: ${orgName}`);
  lines.push(`Gerado em: ${new Date(payload.generated_at).toLocaleString("pt-BR")}`);
  lines.push("");
  for (const sec of payload.sections) {
    lines.push(`## ${sec.title}`);
    for (const l of sec.lines) {
      lines.push(`  • ${l}`);
    }
    if (sec.values && mask) {
      lines.push(`  (Valores agregados: ${Object.entries(sec.values).map(([k, v]) => `${k}=${maskBand(Number(v))}`).join(", ")})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = (await req.json()) as ReqBody;
    if (!body.template_code || !body.organization_id) {
      return new Response(JSON.stringify({ error: "template_code e organization_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", body.organization_id)
      .maybeSingle();

    const { data: schedule } = body.schedule_id
      ? await supabase.from("report_schedules").select("mask_values").eq("id", body.schedule_id).maybeSingle()
      : { data: null };

    const mask = !!schedule?.mask_values;

    const payload = await buildPayload(supabase, body.template_code, body.organization_id);
    const text = renderTextReport(payload, org?.name ?? "Empresa", mask);

    // Generate signed token (HMAC-like: random + base64url)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const signedToken = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

    // Save text "PDF" (placeholder; real PDF generation can be added later via pdfmake)
    const pdfPath = `${body.organization_id}/${body.template_code}/${Date.now()}.txt`;
    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(pdfPath, new Blob([text], { type: "text/plain" }), { contentType: "text/plain", upsert: false });
    if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`);

    const { data: run, error: runErr } = await supabase
      .from("report_runs")
      .insert({
        schedule_id: body.schedule_id ?? null,
        organization_id: body.organization_id,
        template_code: body.template_code,
        trigger_source: body.trigger_source ?? "manual",
        payload,
        pdf_path: pdfPath,
        signed_token: signedToken,
        expires_at: expiresAt.toISOString(),
        status: "generated",
      })
      .select("id")
      .single();

    if (runErr) throw new Error(`Insert run: ${runErr.message}`);

    const { data: signed } = await supabase.storage.from("reports").createSignedUrl(pdfPath, 48 * 3600);

    return new Response(
      JSON.stringify({
        run_id: run.id,
        signed_token: signedToken,
        signed_url: signed?.signedUrl,
        text_preview: text.slice(0, 4000),
        payload,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
