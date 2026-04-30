import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useITEquipment } from "@/hooks/useITEquipment";
import { useITSystems } from "@/hooks/useITSystems";
import { useITTelecom } from "@/hooks/useITTelecom";
import { useITTickets } from "@/hooks/useITTickets";
import { useITIncidents } from "@/hooks/useITIncidents";
import { useITDepreciation } from "@/hooks/useITDepreciation";
import { useITMaterialize } from "@/hooks/useITSchedule";
import { KpiBreakdownDialog } from "./KpiBreakdownDialog";
import {
  Laptop, CheckCircle2, AlertTriangle, Wrench, UserCheck, DollarSign,
  TrendingDown, Cloud, Wifi, Inbox, AlertOctagon, CalendarClock, RefreshCw,
} from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtFull = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function KpiCard({ icon: Icon, label, value, hint, tone = "default", onClick }: any) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
    >
      <Card className="hover:border-primary/50 cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Icon className={`h-4 w-4 ${toneClass}`} />
          </div>
          <p className="text-2xl font-bold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </CardContent>
      </Card>
    </button>
  );
}

export function TIDashboard() {
  const eq = useITEquipment().list.data ?? [];
  const sys = useITSystems().list.data ?? [];
  const tel = useITTelecom().list.data ?? [];
  const tk = useITTickets().list.data ?? [];
  const inc = useITIncidents().list.data ?? [];
  const depr = useITDepreciation().list.data ?? [];
  const { materializeRecurring } = useITMaterialize();

  const [breakdown, setBreakdown] = useState<any>(null);

  const stats = useMemo(() => {
    const ativos = eq.filter((e: any) => ["ativo", "em_uso"].includes(e.status));
    const inativos = eq.filter((e: any) => ["inativo", "baixado", "vendido", "extraviado"].includes(e.status));
    const manut = eq.filter((e: any) => e.status === "em_manutencao");
    const disp = eq.filter((e: any) => e.status === "disponivel");
    const vinc = eq.filter((e: any) => !!e.responsible_employee_id);
    const valorAquisicao = eq.reduce((a: number, e: any) => a + Number(e.acquisition_value || 0), 0);

    const sysAtivos = sys.filter((s: any) => s.status === "ativo");
    const custoMensalSys = sysAtivos.reduce((a: number, s: any) => a + Number(s.monthly_value || 0), 0);
    const telAtivos = tel.filter((t: any) => t.status === "ativo");
    const custoMensalTel = telAtivos.reduce((a: number, t: any) => a + Number(t.monthly_value || 0), 0);

    const tkAbertos = tk.filter((t: any) => !["resolvido", "cancelado"].includes(t.status));
    const tkVencidos = tk.filter((t: any) =>
      (t.sla_resolution_breach || (t.sla_resolution_due && new Date(t.sla_resolution_due) < new Date()))
      && !["resolvido", "cancelado"].includes(t.status)
    );

    const valorContabil = depr.reduce((a: number, d: any) => a + Number(d.accounting_value || 0), 0);

    // Renovações próximas em 90 dias
    const today = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    const renovacoes = [
      ...sys.filter((s: any) => s.renewal_date && new Date(s.renewal_date) <= horizon && new Date(s.renewal_date) >= today).map((s: any) => ({ ...s, _kind: "Sistema" })),
      ...tel.filter((t: any) => t.renewal_date && new Date(t.renewal_date) <= horizon && new Date(t.renewal_date) >= today).map((t: any) => ({ ...t, _kind: "Link" })),
    ].sort((a, b) => +new Date(a.renewal_date) - +new Date(b.renewal_date));

    return {
      ativos, inativos, manut, disp, vinc, valorAquisicao,
      sysAtivos, custoMensalSys, telAtivos, custoMensalTel,
      tkAbertos, tkVencidos, incidentes: inc, valorContabil, renovacoes,
    };
  }, [eq, sys, tel, tk, inc, depr]);

  const openBreakdown = (kind: string) => {
    switch (kind) {
      case "equipamentos":
        setBreakdown({
          title: "Equipamentos cadastrados",
          formula: "COUNT(it_equipment) WHERE organization_id = atual",
          total: String(eq.length),
          items: eq.map((e: any) => ({ label: e.name, hint: e.patrimonial_code, value: e.status })),
        });
        break;
      case "ativos":
        setBreakdown({
          title: "Equipamentos ativos / em uso",
          formula: "COUNT WHERE status IN ('ativo','em_uso')",
          total: String(stats.ativos.length),
          items: stats.ativos.map((e: any) => ({ label: e.name, hint: e.patrimonial_code, value: e.status })),
        });
        break;
      case "valor":
        setBreakdown({
          title: "Valor de aquisição total",
          formula: "SUM(acquisition_value) WHERE organization_id = atual",
          total: fmtFull(stats.valorAquisicao),
          items: eq.filter((e: any) => Number(e.acquisition_value || 0) > 0).map((e: any) => ({
            label: e.name, hint: e.patrimonial_code,
            value: fmtFull(Number(e.acquisition_value || 0)),
          })),
        });
        break;
      case "contabil":
        setBreakdown({
          title: "Valor contábil consolidado",
          formula: "SUM(accounting_value) FROM it_depreciation_params",
          total: fmtFull(stats.valorContabil),
          items: depr.map((d: any) => {
            const e: any = eq.find((x: any) => x.id === d.equipment_id);
            return {
              label: e?.name ?? "—",
              hint: e?.patrimonial_code,
              value: fmtFull(Number(d.accounting_value || 0)),
            };
          }),
        });
        break;
      case "sysCusto":
        setBreakdown({
          title: "Custo mensal — Sistemas ativos",
          formula: "SUM(monthly_value) WHERE status='ativo'",
          total: fmtFull(stats.custoMensalSys),
          items: stats.sysAtivos.map((s: any) => ({
            label: s.name, hint: s.category,
            value: fmtFull(Number(s.monthly_value || 0)),
          })),
        });
        break;
      case "telCusto":
        setBreakdown({
          title: "Custo mensal — Links de Telecom",
          formula: "SUM(monthly_value) WHERE status='ativo'",
          total: fmtFull(stats.custoMensalTel),
          items: stats.telAtivos.map((t: any) => ({
            label: t.name, hint: t.link_type,
            value: fmtFull(Number(t.monthly_value || 0)),
          })),
        });
        break;
      case "chamados":
        setBreakdown({
          title: "Chamados abertos",
          formula: "COUNT WHERE status NOT IN ('resolvido','cancelado')",
          total: String(stats.tkAbertos.length),
          items: stats.tkAbertos.map((t: any) => ({
            label: t.title,
            hint: `${t.ticket_number} — ${t.priority}`,
            value: t.status,
          })),
        });
        break;
      case "renovacoes":
        setBreakdown({
          title: "Renovações nos próximos 90 dias",
          formula: "renewal_date BETWEEN hoje E hoje+90d",
          total: String(stats.renovacoes.length),
          items: stats.renovacoes.map((r: any) => ({
            label: r.name, hint: r._kind,
            value: new Date(r.renewal_date).toLocaleDateString("pt-BR"),
          })),
        });
        break;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const { supabase } = await import("@/integrations/supabase/client");
            const { toast } = await import("sonner");
            const { data, error } = await supabase.functions.invoke("it-daily-alerts", { body: {} });
            if (error) toast.error("Falha ao rodar alertas: " + error.message);
            else {
              const c = (data as any)?.counters ?? {};
              const total = (c.renewals || 0) + (c.sla || 0) + (c.warranty || 0) + (c.telecom || 0);
              toast.success(`${total} alerta(s) gerado(s).`);
            }
          }}
        >
          <AlertTriangle className="h-4 w-4 mr-2" /> Rodar alertas agora
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={materializeRecurring.isPending}
          onClick={() => materializeRecurring.mutate(12)}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${materializeRecurring.isPending ? "animate-spin" : ""}`} />
          Projetar custos no Fluxo de Caixa (12 meses)
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard icon={Laptop} label="Equipamentos" value={eq.length} hint={`${stats.ativos.length} ativos`} onClick={() => openBreakdown("equipamentos")} />
        <KpiCard icon={CheckCircle2} label="Disponíveis" value={stats.disp.length} tone="success" onClick={() => openBreakdown("ativos")} />
        <KpiCard icon={Wrench} label="Em manutenção" value={stats.manut.length} tone="warning" />
        <KpiCard icon={AlertTriangle} label="Inativos" value={stats.inativos.length} tone="danger" />
        <KpiCard icon={UserCheck} label="Vinculados" value={stats.vinc.length} hint="a colaboradores" />
        <KpiCard icon={DollarSign} label="Valor aquisição" value={fmt(stats.valorAquisicao)} onClick={() => openBreakdown("valor")} />
        <KpiCard icon={TrendingDown} label="Valor contábil" value={fmt(stats.valorContabil)} onClick={() => openBreakdown("contabil")} />
        <KpiCard icon={Cloud} label="Sistemas ativos" value={stats.sysAtivos.length} hint={`${fmt(stats.custoMensalSys)}/mês`} onClick={() => openBreakdown("sysCusto")} />
        <KpiCard icon={Wifi} label="Links ativos" value={stats.telAtivos.length} hint={`${fmt(stats.custoMensalTel)}/mês`} onClick={() => openBreakdown("telCusto")} />
        <KpiCard icon={Inbox} label="Chamados abertos" value={stats.tkAbertos.length} hint={stats.tkVencidos.length ? `${stats.tkVencidos.length} fora do SLA` : "no prazo"} tone={stats.tkVencidos.length ? "danger" : "default"} onClick={() => openBreakdown("chamados")} />
        <KpiCard icon={AlertOctagon} label="Incidentes" value={inc.length} tone={inc.length ? "warning" : "default"} />
        <KpiCard icon={CalendarClock} label="Renovações 90d" value={stats.renovacoes.length} onClick={() => openBreakdown("renovacoes")} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Próximas renovações</CardTitle></CardHeader>
        <CardContent>
          {stats.renovacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma renovação nos próximos 90 dias.</p>
          ) : (
            <div className="divide-y">
              {stats.renovacoes.slice(0, 8).map((r: any) => (
                <div key={r.id} className="flex justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground ml-2">[{r._kind}]</span>
                  </div>
                  <div className="text-muted-foreground">{new Date(r.renewal_date).toLocaleDateString("pt-BR")}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {breakdown && (
        <KpiBreakdownDialog
          open={!!breakdown}
          onOpenChange={(o) => !o && setBreakdown(null)}
          title={breakdown.title}
          formula={breakdown.formula}
          total={breakdown.total}
          items={breakdown.items}
        />
      )}
    </div>
  );
}
